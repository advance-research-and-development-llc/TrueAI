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
export { HF_API_BASE, GGUF_EXTENSIONS, searchHuggingFaceModels, getModelFiles } from './api'
export { downloadModel } from './download'

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
 * types a search term. Phase 2 refreshes this with non-`TheBloke`
 * publishers (`bartowski`, `lmstudio-community`, `unsloth`, `Qwen`,
 * `microsoft/Phi-3`); for Phase 1 the original list is preserved
 * verbatim so the existing branch-coverage tests stay green.
 */
export function getPopularGGUFModels(): string[] {
  return [
    'TheBloke/Llama-2-7B-Chat-GGUF',
    'TheBloke/Mistral-7B-Instruct-v0.2-GGUF',
    'TheBloke/Phi-3-mini-4k-instruct-GGUF',
    'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF',
    'TheBloke/CodeLlama-7B-Instruct-GGUF',
    'TheBloke/neural-chat-7B-v3-3-GGUF',
    'TheBloke/zephyr-7B-beta-GGUF',
    'bartowski/Meta-Llama-3-8B-Instruct-GGUF',
  ]
}
