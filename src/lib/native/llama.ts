/**
 * On-device llama.cpp runtime — JS shim.
 *
 * This is the typed wrapper around the in-tree Capacitor `Llama` plugin
 * (`android/capacitor-llama/`). It exposes load / unload / isLoaded /
 * one-shot complete primitives. Streaming and the AI-SDK-shaped
 * `local-native` provider land in PR 4 of the OfflineLLM-comparison
 * plan and will be added next to (not on top of) this surface.
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
 * Callers must treat this as best-effort: the AI-SDK provider in PR 4
 * falls back to `local-wasm` (wllama) when this engine is unavailable.
 */

import { registerPlugin } from '@capacitor/core'
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
 * Native-side surface registered by `MainActivity.registerPlugin(LlamaPlugin.class)`.
 * Web has no implementation; calls reject if invoked.
 */
export interface LlamaPlugin {
  loadModel(options: LlamaLoadOptions): Promise<LlamaLoadResult>
  unloadModel(): Promise<LlamaUnloadResult>
  isLoaded(): Promise<LlamaIsLoadedResult>
  complete(options: LlamaCompleteOptions): Promise<LlamaCompleteResult>
}

// `registerPlugin` returns a proxy that no-ops on web (Capacitor 8
// behaviour: any method call on an unregistered plugin rejects with an
// "implementation not available" error). That is exactly the
// degradation we want — `isAvailable()` below is the canonical probe.
const Llama = registerPlugin<LlamaPlugin>('Llama')

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
}

export type LlamaApi = typeof llama
