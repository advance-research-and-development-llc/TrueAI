/**
 * On-device llama.cpp runtime — JS shim.
 *
 * Typed wrapper around the in-tree Capacitor `Llama` plugin
 * (`android/capacitor-llama/`). Exposes load / unload / isLoaded /
 * one-shot complete (PR 2) and streaming complete + abort (PR 4).
 *
 * Threat model / availability:
 *   - The Capacitor plugin is only registered on Android (see
 *     `MainActivity.java`). On iOS and on web `isAvailable()` returns
 *     false and every other call rejects with `ENGINE_UNAVAILABLE`.
 *   - On Android, even when the plugin IS registered, the underlying
 *     native library may be missing (e.g. a debug build that left
 *     `-PenableLlamaNative=true` off, or a device whose ABI we don't
 *     ship). The plugin propagates that as `ENGINE_UNAVAILABLE` so the
 *     JS layer always has the same rejection contract.
 *
 * Callers should treat this as best-effort: the AI-SDK `local-native`
 * provider (`local-native-provider.ts`) falls back to `local-wasm`
 * (wllama) when this engine is unavailable, so users get on-device
 * inference on every platform without reconfiguring.
 */

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { isAndroid, isPluginAvailable } from './platform'

/** Options accepted by `loadModel`. */
export interface LlamaLoadOptions {
  modelPath: string
  /** Context window size in tokens. Default 2048 (matches `runtime-provider-options.ts`). */
  nCtx?: number
  /** CPU thread count for inference. Default 4. */
  nThreads?: number
  /** Layers to offload to GPU. Default 0 (CPU-only). */
  nGpuLayers?: number
}

/** Options accepted by `complete`. Sampling defaults match OfflineLLM. */
export interface LlamaCompleteOptions {
  prompt: string
  nPredict?: number
  temperature?: number
  topP?: number
  topK?: number
  minP?: number
  repeatPenalty?: number
}

export interface LlamaLoadResult {
  loaded: boolean
  modelPath: string
}

export interface LlamaUnloadResult {
  loaded: boolean
}

export interface LlamaIsLoadedResult {
  loaded: boolean
}

export interface LlamaCompleteResult {
  text: string
  finishReason: 'stop' | 'length' | 'error'
}

/**
 * Options for `streamComplete`. Identical sampling surface to
 * {@link LlamaCompleteOptions}; the only difference is delivery — token
 * pieces arrive incrementally on the supplied `onToken` callback rather
 * than as a single string at the end. Aliased rather than declared as
 * an empty-extends interface so callers can swap in either type.
 */
export type LlamaStreamOptions = LlamaCompleteOptions

/** A single token piece delivered to a streaming callback. */
export interface LlamaStreamChunk {
  /** UTF-8 text piece for this token. May be empty for control tokens. */
  piece: string
  /**
   * Cumulative text generated so far, equivalent to concatenating every
   * `piece` since the stream started. Mirrors the `currentText` shape
   * used by the wllama adapter so the AI-SDK provider can compute deltas
   * with the same logic on both runtimes.
   */
  currentText: string
}

/** Terminal frame for a stream, delivered as the last `onToken` invocation. */
export interface LlamaStreamDone {
  /** True when this is the terminal frame; `piece` and `currentText` are empty. */
  done: true
  finishReason: 'stop' | 'length' | 'aborted' | 'error'
  /** Present only when `finishReason === 'error'`. */
  errorMessage?: string
}

export type LlamaStreamEvent = (LlamaStreamChunk & { done?: false }) | LlamaStreamDone

/** Handle returned by `streamComplete`. */
export interface LlamaStreamHandle {
  /** Opaque id the JNI layer uses to route token events back to this handle. */
  streamId: string
  /**
   * Cancel an in-flight stream. Resolves once the JNI side has
   * acknowledged the cancel (the C++ loop checks the cancel flag
   * between tokens, so a busy stream may emit one or two more pieces
   * before the terminal `aborted` frame arrives).
   */
  abort(): Promise<void>
}

/**
 * Native-side surface registered by `MainActivity.registerPlugin(LlamaPlugin.class)`.
 * Web has no implementation; calls reject if invoked.
 *
 * Streaming uses Capacitor's notifyListeners mechanism: the plugin
 * fires `llamaToken-<streamId>` events for each piece and one terminal
 * `llamaToken-<streamId>` event with `{ done: true, finishReason }`.
 * Per-stream event names keep concurrent streams (forward-compat with
 * the LRU planned for PR 4.b) from cross-talking.
 */
export interface LlamaPlugin {
  loadModel(options: LlamaLoadOptions): Promise<LlamaLoadResult>
  unloadModel(): Promise<LlamaUnloadResult>
  isLoaded(): Promise<LlamaIsLoadedResult>
  complete(options: LlamaCompleteOptions): Promise<LlamaCompleteResult>
  /**
   * Start a streaming generation. The returned promise resolves once the
   * native side has accepted the request (i.e. tokenisation succeeded
   * and the decode loop has been scheduled); token deliveries flow
   * through `addListener('llamaToken-<streamId>', ...)`. Resolves with
   * the assigned `streamId`, which is also embedded in the event name.
   */
  streamComplete(
    options: LlamaStreamOptions & { streamId: string },
  ): Promise<{ streamId: string }>
  /** Signal cancellation for a previously-started stream. */
  abortStream(options: { streamId: string }): Promise<void>
  addListener(
    eventName: string,
    listener: (event: LlamaStreamEvent) => void,
  ): Promise<PluginListenerHandle>
}

// `registerPlugin` returns a proxy that no-ops on web (Capacitor 8
// behaviour: any method call on an unregistered plugin rejects with an
// "implementation not available" error). That is exactly the
// degradation we want — `isAvailable()` below is the canonical probe.
const Llama = registerPlugin<LlamaPlugin>('Llama')

/**
 * Monotonic counter used to allocate per-stream event names. Combined
 * with `Date.now()` so identical sequence numbers across page reloads
 * do not collide with stale Capacitor listeners.
 */
let streamSeq = 0

/**
 * True only when the native plugin is registered AND callable. PR 2 ships
 * the plugin only on Android, so this returns false on web and iOS.
 *
 * Note: this does NOT verify that the JNI shared library was compiled
 * into the APK (some flavors may ship without it). Callers that need
 * that guarantee should call `loadModel` and handle an
 * `ENGINE_UNAVAILABLE` rejection.
 */
export function isAvailable(): boolean {
  return isAndroid() && isPluginAvailable('Llama')
}

function unavailableError(): Error {
  const err = new Error(
    'Llama native runtime is not available on this platform/build',
  )
  ;(err as Error & { code?: string }).code = 'ENGINE_UNAVAILABLE'
  return err
}

export const llama = {
  isAvailable,

  async loadModel(options: LlamaLoadOptions): Promise<LlamaLoadResult> {
    if (!isAvailable()) throw unavailableError()
    if (!options.modelPath) throw new Error('modelPath is required')
    return Llama.loadModel(options)
  },

  async unloadModel(): Promise<LlamaUnloadResult> {
    if (!isAvailable()) throw unavailableError()
    return Llama.unloadModel()
  },

  async isLoaded(): Promise<boolean> {
    if (!isAvailable()) return false
    try {
      const { loaded } = await Llama.isLoaded()
      return loaded
    } catch {
      return false
    }
  },

  async complete(options: LlamaCompleteOptions): Promise<LlamaCompleteResult> {
    if (!isAvailable()) throw unavailableError()
    if (typeof options.prompt !== 'string') {
      throw new Error('prompt is required')
    }
    return Llama.complete(options)
  },

  /**
   * Start a streaming completion. `onEvent` is invoked once per token
   * piece followed by exactly one terminal `{ done: true, finishReason }`
   * event, after which the underlying Capacitor listener is detached.
   *
   * The returned `LlamaStreamHandle.abort()` cancels the stream; callers
   * still receive the terminal frame (with `finishReason: 'aborted'`)
   * because the C++ loop checks the cancel flag between tokens.
   *
   * Errors thrown synchronously from this function (no model loaded,
   * empty prompt, engine unavailable) reject before any listener is
   * registered. Errors raised by the native side after the stream has
   * started are delivered as a terminal `finishReason: 'error'` event,
   * not as a promise rejection — this keeps the reactive AI-SDK
   * provider's stream-controller logic uniform.
   */
  async streamComplete(
    options: LlamaStreamOptions,
    onEvent: (event: LlamaStreamEvent) => void,
  ): Promise<LlamaStreamHandle> {
    if (!isAvailable()) throw unavailableError()
    if (typeof options.prompt !== 'string') {
      throw new Error('prompt is required')
    }
    if (typeof onEvent !== 'function') {
      throw new Error('onEvent callback is required')
    }
    streamSeq += 1
    const streamId = `s${Date.now().toString(36)}-${streamSeq}`
    const eventName = `llamaToken-${streamId}`
    let handle: PluginListenerHandle | null = null
    let settled = false
    const detach = () => {
      if (settled) return
      settled = true
      if (handle) {
        // Best-effort detach. Capacitor's PluginListenerHandle.remove()
        // is itself async; we don't await it because the JNI side has
        // already torn down the loop by the time the terminal frame
        // fires, and a stray late event would simply be a no-op once
        // the listener is gone.
        try {
          void handle.remove()
        } catch {
          // Swallow: a failed remove() is at worst a tiny memory leak
          // for the lifetime of the page; it must never break the
          // caller's promise chain.
        }
        handle = null
      }
    }
    handle = await Llama.addListener(eventName, (event) => {
      try {
        onEvent(event)
      } finally {
        if ('done' in event && event.done === true) detach()
      }
    })
    try {
      await Llama.streamComplete({ ...options, streamId })
    } catch (err) {
      detach()
      throw err
    }
    return {
      streamId,
      async abort() {
        try {
          await Llama.abortStream({ streamId })
        } finally {
          // Don't detach here — the JNI side will still emit a terminal
          // `aborted` frame, and the listener wrapper above tears the
          // handle down when that arrives.
        }
      },
    }
  },
}

export type LlamaApi = typeof llama
