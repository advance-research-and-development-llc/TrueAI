/**
 * On-device GGUF runtime adapter for the Vercel AI SDK — native path.
 *
 * Wraps the in-tree Capacitor `Llama` plugin (`android/capacitor-llama/`,
 * fronted by `src/lib/native/llama.ts`) into a `LanguageModelV3`-shaped
 * object so it can be returned from `getLanguageModel()` alongside the
 * HTTP-server providers and the WASM-based `local-wasm` provider.
 *
 * Local-first guarantees:
 *   - The native llama.cpp library is loaded by the Capacitor plugin
 *     only on Android. On web and iOS, `llama.isAvailable()` returns
 *     false and this adapter delegates transparently to the
 *     `local-wasm` (wllama) provider — users get on-device inference on
 *     every platform without reconfiguring.
 *   - No network call is made by this module. The GGUF model file is
 *     loaded from a path the caller already has on disk; obtaining
 *     that path (e.g. via the in-app GGUF importer) is PR 5's
 *     responsibility.
 *   - No API key is read or transmitted — `cfg.apiKey` is intentionally
 *     ignored on this provider, matching `local-wasm`.
 *
 * This is the AI-SDK side of PR 4 of the OfflineLLM-comparison plan.
 * The streaming JNI surface lives in the `LlamaPlugin` Java class +
 * `llama_jni.cpp`; this module is the typed bridge that turns those
 * token events into `LanguageModelV3StreamPart` frames.
 */

import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3Message,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
  SharedV3Warning,
} from '@ai-sdk/provider'

import {
  llama as defaultLlama,
  type LlamaApi,
  type LlamaCompleteOptions,
  type LlamaStreamEvent,
} from '@/lib/native/llama'
import {
  createLocalWllamaModel,
  type LocalWllamaOptions,
} from './local-wllama-provider'

/**
 * Options used to construct a `local-native` adapter. Resolved from the
 * current `LLMRuntimeConfig` by `provider-factory.ts`.
 */
export interface LocalNativeOptions {
  /**
   * Path to a `.gguf` file on the device's local filesystem (typically
   * under `Filesystem.Directory.Data/models/<sha256>.gguf`). When empty
   * AND no fallback is available, calls reject with a clear "no local
   * model configured" error.
   */
  modelPath: string
  /** Model id reported as `LanguageModel.modelId` (logical name). */
  modelId: string
  /** Maximum tokens to generate by default. */
  maxOutputTokens?: number
  /** `n_ctx` forwarded to the native runtime at model-load time. */
  contextSize?: number
  /** CPU thread count for inference. */
  nThreads?: number
  /** Layers to offload to GPU. PR 9 will auto-tune this; for now 0. */
  nGpuLayers?: number
  /**
   * Default sampling knobs sourced from `LLMRuntimeConfig`. Per-call
   * `LanguageModelV3CallOptions` win over these.
   */
  defaultSampling?: {
    temperature?: number
    topP?: number
    topK?: number
    minP?: number
    repeatPenalty?: number
  }
  /**
   * Fallback adapter used when `llama.isAvailable()` is false (web, iOS,
   * or an Android build that shipped without the JNI .so). When omitted
   * the factory builds a `local-wasm` adapter pointed at the same
   * runtime config so users always have *some* on-device runtime.
   *
   * Tests inject a stub here.
   */
  fallback?: LanguageModelV3 | null
  /**
   * Test seam: the native shim. Defaults to the real `llama` singleton.
   */
  llamaShim?: LlamaApi
}

const TERMINAL_FINISH_STOP: LanguageModelV3FinishReason = {
  unified: 'stop',
  raw: undefined,
}
const TERMINAL_FINISH_LENGTH: LanguageModelV3FinishReason = {
  unified: 'length',
  raw: undefined,
}
const TERMINAL_FINISH_ABORTED: LanguageModelV3FinishReason = {
  unified: 'other',
  raw: 'aborted',
}
const TERMINAL_FINISH_ERROR: LanguageModelV3FinishReason = {
  unified: 'error',
  raw: undefined,
}
const SYNTHETIC_USAGE: LanguageModelV3Usage = {
  inputTokens: {
    total: undefined,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: undefined,
    text: undefined,
    reasoning: undefined,
  },
}

function finishReasonOf(
  raw: 'stop' | 'length' | 'aborted' | 'error',
): LanguageModelV3FinishReason {
  switch (raw) {
    case 'length':
      return TERMINAL_FINISH_LENGTH
    case 'aborted':
      return TERMINAL_FINISH_ABORTED
    case 'error':
      return TERMINAL_FINISH_ERROR
    case 'stop':
    default:
      return TERMINAL_FINISH_STOP
  }
}

/**
 * Flatten a `LanguageModelV3` prompt into a single text completion
 * prompt. Matches the OfflineLLM-style "system\n\nuser" layout that
 * llama-family chat templates expect; tool / file / reasoning parts
 * are dropped with a warning, mirroring the wllama adapter (PR 16
 * vision will lift this).
 */
function flattenPrompt(
  prompt: ReadonlyArray<LanguageModelV3Message>,
): { text: string; warnings: SharedV3Warning[] } {
  const warnings: SharedV3Warning[] = []
  const lines: string[] = []
  for (const m of prompt) {
    if (m.role === 'system') {
      lines.push(m.content)
      continue
    }
    if (m.role === 'tool') {
      warnings.push({
        type: 'other',
        message: 'tool messages are not supported by local-native; skipping',
      })
      continue
    }
    let text = ''
    let droppedNonText = false
    for (const part of m.content) {
      if (part.type === 'text') {
        text += part.text
      } else {
        droppedNonText = true
      }
    }
    if (droppedNonText) {
      warnings.push({
        type: 'other',
        message: `non-text parts in ${m.role} message dropped (local-native provider)`,
      })
    }
    // Tag with role so a basic chat template embedded in the GGUF
    // metadata can still distinguish turns. PR 8 (per-model defaults)
    // will replace this with proper chat-template rendering.
    const tag = m.role === 'user' ? 'User' : 'Assistant'
    lines.push(`${tag}: ${text}`)
  }
  // Final "Assistant:" cue so the model continues as the assistant.
  lines.push('Assistant:')
  return { text: lines.join('\n\n'), warnings }
}

/**
 * Merge runtime defaults with per-call AI-SDK options into the native
 * sampling shape. Per-call values always win.
 */
function buildSamplingOptions(
  callOpts: LanguageModelV3CallOptions,
  opts: LocalNativeOptions,
  prompt: string,
): LlamaCompleteOptions {
  const d = opts.defaultSampling ?? {}
  const out: LlamaCompleteOptions = { prompt }
  const nPredict = callOpts.maxOutputTokens ?? opts.maxOutputTokens
  if (typeof nPredict === 'number' && nPredict > 0) out.nPredict = nPredict
  const temperature =
    typeof callOpts.temperature === 'number' ? callOpts.temperature : d.temperature
  if (typeof temperature === 'number') out.temperature = temperature
  const topP = typeof callOpts.topP === 'number' ? callOpts.topP : d.topP
  if (typeof topP === 'number') out.topP = topP
  const topK = typeof callOpts.topK === 'number' ? callOpts.topK : d.topK
  if (typeof topK === 'number' && topK > 0) out.topK = topK
  if (typeof d.minP === 'number' && d.minP > 0) out.minP = d.minP
  // Map AI-SDK frequencyPenalty → llama.cpp repeatPenalty when set,
  // otherwise fall back to the runtime-config default. Matches the
  // wllama provider's mapping (`1 + frequencyPenalty`).
  if (typeof callOpts.frequencyPenalty === 'number' && callOpts.frequencyPenalty > 0) {
    out.repeatPenalty = 1 + callOpts.frequencyPenalty
  } else if (typeof d.repeatPenalty === 'number' && d.repeatPenalty > 1) {
    out.repeatPenalty = d.repeatPenalty
  }
  return out
}

/**
 * Track which model file is currently loaded into the native runtime so
 * we don't unload-and-reload on every call. PR 4.b will replace this
 * single-slot cache with a small LRU.
 */
let cachedModelPath: string | null = null
let cachedContextSize: number | undefined = undefined
let cachedThreads: number | undefined = undefined
let cachedGpuLayers: number | undefined = undefined
let loadInFlight: Promise<void> | null = null

/** Test-only: forget the cached load state so the next call re-loads. */
export function __resetLocalNativeForTests(): void {
  cachedModelPath = null
  cachedContextSize = undefined
  cachedThreads = undefined
  cachedGpuLayers = undefined
  loadInFlight = null
}

async function ensureModelLoaded(
  shim: LlamaApi,
  opts: LocalNativeOptions,
): Promise<void> {
  const path = opts.modelPath?.trim() ?? ''
  if (path.length === 0) {
    throw new Error(
      "Local on-device runtime is selected but no model is configured. " +
        'Use the in-app GGUF importer (PR 5) or set Settings → LLM Runtime → ' +
        "'Base URL' to a local .gguf path.",
    )
  }
  if (
    cachedModelPath === path &&
    cachedContextSize === opts.contextSize &&
    cachedThreads === opts.nThreads &&
    cachedGpuLayers === opts.nGpuLayers
  ) {
    return
  }
  if (loadInFlight) {
    // A concurrent load is racing with us. Wait for it; if it landed on
    // the same config we're done, otherwise fall through and re-load.
    await loadInFlight
    if (
      cachedModelPath === path &&
      cachedContextSize === opts.contextSize &&
      cachedThreads === opts.nThreads &&
      cachedGpuLayers === opts.nGpuLayers
    ) {
      return
    }
  }
  const inFlight = (async () => {
    if (cachedModelPath !== null && cachedModelPath !== path) {
      // Native bridge enforces a single-model invariant; unload first.
      try {
        await shim.unloadModel()
      } catch {
        // Best-effort: if unload fails (e.g. the bridge thinks no model
        // is loaded) we still try to load — loadModel will surface a
        // real error if the bridge is in a broken state.
      }
      cachedModelPath = null
    }
    await shim.loadModel({
      modelPath: path,
      nCtx: opts.contextSize,
      nThreads: opts.nThreads,
      nGpuLayers: opts.nGpuLayers,
    })
    cachedModelPath = path
    cachedContextSize = opts.contextSize
    cachedThreads = opts.nThreads
    cachedGpuLayers = opts.nGpuLayers
  })()
  loadInFlight = inFlight.finally(() => {
    if (loadInFlight === inFlight) loadInFlight = null
  })
  await loadInFlight
}

/**
 * Resolve a fallback `LanguageModelV3`. Used when `llama.isAvailable()`
 * is false. Returns the explicitly-configured fallback when present;
 * otherwise builds a `local-wasm` adapter from the same options so the
 * user always gets *some* on-device runtime without changing settings.
 */
function resolveFallback(opts: LocalNativeOptions): LanguageModelV3 {
  if (opts.fallback) return opts.fallback
  const wasmOpts: LocalWllamaOptions = {
    // The native provider's `modelPath` is a local file path; wllama
    // can't load that on web. Pass it through as the modelSource so the
    // wllama provider produces its own helpful "no model source
    // configured" error rather than silently silently degrading. The
    // typical path here is: user picked `local-native` on a web build,
    // wllama then tells them to point Base URL at a .gguf URL instead.
    modelSource: opts.modelPath,
    modelId: opts.modelId,
    maxOutputTokens: opts.maxOutputTokens,
    contextSize: opts.contextSize,
    defaultSampling: {
      topK: opts.defaultSampling?.topK,
      minP: opts.defaultSampling?.minP,
      repeatPenalty: opts.defaultSampling?.repeatPenalty,
    },
  }
  return createLocalWllamaModel(wasmOpts)
}

/**
 * Build a `LanguageModelV3` adapter backed by the on-device native
 * llama.cpp runtime. Falls back to `local-wasm` automatically when the
 * native engine is not available.
 */
export function createLocalNativeModel(opts: LocalNativeOptions): LanguageModelV3 {
  const provider = 'local-native'
  const modelId = opts.modelId
  const shim = opts.llamaShim ?? defaultLlama

  // Capture the fallback lazily — the `local-wasm` adapter is cheap to
  // construct, but doing it inside the call paths keeps cold-start cost
  // off the constructor for the native-available case.
  let fallback: LanguageModelV3 | null = null
  function getFallback(): LanguageModelV3 {
    if (!fallback) fallback = resolveFallback(opts)
    return fallback
  }

  return {
    specificationVersion: 'v3',
    provider,
    modelId,
    supportedUrls: {},
    async doGenerate(
      callOpts: LanguageModelV3CallOptions,
    ): Promise<LanguageModelV3GenerateResult> {
      if (!shim.isAvailable()) {
        return getFallback().doGenerate(callOpts)
      }
      await ensureModelLoaded(shim, opts)
      const { text: prompt, warnings } = flattenPrompt(callOpts.prompt)
      const sampling = buildSamplingOptions(callOpts, opts, prompt)
      const result = await shim.complete(sampling)
      return {
        content: [{ type: 'text', text: result.text }],
        finishReason: finishReasonOf(result.finishReason),
        usage: SYNTHETIC_USAGE,
        warnings,
      }
    },
    async doStream(
      callOpts: LanguageModelV3CallOptions,
    ): Promise<LanguageModelV3StreamResult> {
      if (!shim.isAvailable()) {
        return getFallback().doStream(callOpts)
      }
      await ensureModelLoaded(shim, opts)
      const { text: prompt, warnings } = flattenPrompt(callOpts.prompt)
      const sampling = buildSamplingOptions(callOpts, opts, prompt)
      const id = `local-native-${Date.now().toString(36)}`

      // Caller-supplied AbortSignal: when it fires we tell the JNI side
      // to cancel; the bridge still sends a terminal `aborted` frame
      // which closes the stream cleanly.
      let abortHandle: { abort(): Promise<void> } | null = null
      const onAbort = () => {
        if (abortHandle) {
          void abortHandle.abort().catch(() => {
            /* best-effort: terminal frame will close the stream anyway */
          })
        }
      }
      if (callOpts.abortSignal) {
        if (callOpts.abortSignal.aborted) {
          // Already aborted — return an immediately-closed stream so the
          // AI SDK doesn't sit waiting for tokens that never come.
          const stream = new ReadableStream<LanguageModelV3StreamPart>({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings })
              controller.enqueue({
                type: 'finish',
                finishReason: TERMINAL_FINISH_ABORTED,
                usage: SYNTHETIC_USAGE,
              })
              controller.close()
            },
          })
          return { stream }
        }
        callOpts.abortSignal.addEventListener('abort', onAbort, { once: true })
      }

      let prevText = ''
      const stream = new ReadableStream<LanguageModelV3StreamPart>({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings })
          controller.enqueue({ type: 'text-start', id })
          try {
            abortHandle = await shim.streamComplete(sampling, (event: LlamaStreamEvent) => {
              if ('done' in event && event.done === true) {
                controller.enqueue({ type: 'text-end', id })
                if (event.finishReason === 'error') {
                  controller.enqueue({
                    type: 'error',
                    error: new Error(event.errorMessage ?? 'native llama error'),
                  })
                }
                controller.enqueue({
                  type: 'finish',
                  finishReason: finishReasonOf(event.finishReason),
                  usage: SYNTHETIC_USAGE,
                })
                controller.close()
                if (callOpts.abortSignal) {
                  callOpts.abortSignal.removeEventListener('abort', onAbort)
                }
                return
              }
              // Token piece: prefer the explicit `piece` field, fall
              // back to delta-from-cumulative for forward compatibility
              // with a future "currentText only" emission shape.
              let delta = event.piece
              if (typeof delta !== 'string' || delta.length === 0) {
                if (
                  event.currentText.length > prevText.length &&
                  event.currentText.startsWith(prevText)
                ) {
                  delta = event.currentText.slice(prevText.length)
                } else {
                  delta = ''
                }
              }
              if (delta.length > 0) {
                controller.enqueue({ type: 'text-delta', id, delta })
              }
              prevText = event.currentText
            })
          } catch (err) {
            controller.enqueue({ type: 'text-end', id })
            controller.enqueue({ type: 'error', error: err })
            controller.enqueue({
              type: 'finish',
              finishReason: TERMINAL_FINISH_ERROR,
              usage: SYNTHETIC_USAGE,
            })
            controller.close()
            if (callOpts.abortSignal) {
              callOpts.abortSignal.removeEventListener('abort', onAbort)
            }
          }
        },
      })
      return { stream }
    },
  }
}
