/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Shared Hugging Face data types — extracted from the original
 * monolithic `src/lib/huggingface.ts` as the first phase of PR 6
 * (Model-Hub Browser hardening). No shape changes in this phase;
 * later phases add `quantTag`, `shardCount`, and `lfsSha256` to
 * `HuggingFaceModel` (which lives in `@/lib/types`).
 */

export interface HFSearchResult {
  id: string
  modelId: string
  author: string
  downloads: number
  likes: number
  tags: string[]
  siblings?: HFFile[]
  private: boolean
  lastModified: string
}

export interface HFFile {
  rfilename: string
  size: number
}

export interface HFModelCard {
  modelId: string
  tags: string[]
  pipeline_tag?: string
  library_name?: string
}
