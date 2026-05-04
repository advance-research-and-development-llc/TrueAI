/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Single-stream downloader — preserved verbatim from the original
 * `huggingface.ts` as Phase 1 of PR 6. Phase 6 replaces this with
 * `downloadModelToRegistry`, which adds:
 *   - parallel range-chunk fetches
 *   - resume-on-failure via the KV-backed `resume-store`
 *   - streaming SHA-256 verified against HF's LFS oid
 *   - registry write through `gguf/registry.importDownloadedBlob`
 *
 * The current export is kept callable for backward compatibility
 * with `HuggingFaceModelBrowser.tsx` and the existing test suite.
 */

export async function downloadModel(
  url: string,
  onProgress?: (progress: number, downloaded: number, total: number) => void
): Promise<Blob> {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`)
    }

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0

    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let downloaded = 0

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      chunks.push(value)
      downloaded += value.length

      if (onProgress && total > 0) {
        const progress = (downloaded / total) * 100
        onProgress(progress, downloaded, total)
      }
    }

    const blob = new Blob(chunks as BlobPart[])
    return blob
  } catch (error) {
    console.error('Error downloading model:', error)
    throw error
  }
}
