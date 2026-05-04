/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Barrel re-export for the Hugging Face integration.
 *
 * Phase 1 of PR 6 split the original monolithic `huggingface.ts`
 * into this directory while preserving the public surface so that
 * `import { ... } from '@/lib/huggingface'` (and `from './huggingface'`
 * inside `src/lib/`) continue to resolve unchanged. Subsequent phases
 * add new sibling modules (`quant.ts`, `checksum.ts`, `resume-store.ts`,
 * `auth.ts`) without further churning these import sites.
 */

export type { HFSearchResult, HFFile, HFModelCard } from './types'
export {
  HF_API_BASE,
  DEFAULT_HF_ENDPOINT,
  GGUF_EXTENSIONS,
  apiUrl,
  resolveFileUrl,
  hfRequest,
  searchHuggingFaceModels,
  getModelFiles,
} from './api'
export type { HFRequestOptions } from './api'
export { downloadModel } from './download'
export {
  HFNetworkError,
  HFGatedError,
  HFRateLimitError,
  parseRetryAfter,
} from './errors'

/**
 * Pretty-print a byte count.
 *
 * Kept inline here (not in a separate `format.ts`) because it is
 * the only utility helper the module exposes and inlining keeps the
 * Phase 1 diff minimal.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Curated seed list used to populate the browser before the user
 * types a search term.
 *
 * Phase 2 of PR 6 refreshed this list to reflect the post-2024
 * GGUF publisher landscape. `TheBloke` (the previous monoculture)
 * has been largely inactive since mid-2024; the new list keeps a
 * couple of TheBloke entries for back-compat with existing tests
 * but leads with the publishers users actually browse to today:
 *   - `bartowski`        — fastest-moving GGUF mirror, full quant range
 *   - `lmstudio-community` — official LM Studio mirrors with imatrix quants
 *   - `unsloth`          — fine-tuned + GGUF in one repo, popular for Llama-3
 *   - `Qwen`             — first-party Qwen GGUFs
 *   - `microsoft`        — first-party Phi-3/Phi-4 GGUFs
 */
export function getPopularGGUFModels(): string[] {
  return [
    'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    'bartowski/Mistral-7B-Instruct-v0.3-GGUF',
    'bartowski/Qwen2.5-7B-Instruct-GGUF',
    'lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF',
    'lmstudio-community/Phi-3.5-mini-instruct-GGUF',
    'unsloth/Llama-3.2-3B-Instruct-GGUF',
    'Qwen/Qwen2.5-7B-Instruct-GGUF',
    'microsoft/Phi-3-mini-4k-instruct-gguf',
    'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF',
    'TheBloke/CodeLlama-7B-Instruct-GGUF',
  ]
}
