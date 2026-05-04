/**
 * Copyright (c) 2024-2026 Skyler Jones ("smackypants") /
 * Advanced Technology Research. Licensed under MIT.
 */

/**
 * Hugging Face REST API client — search + model-file listing.
 *
 * Phase 1 of PR 6 splits the original monolithic `huggingface.ts`
 * into `api.ts` / `download.ts` / `types.ts` / `index.ts` with **zero
 * behaviour change**. Later phases harden this module with:
 *   - configurable endpoint (`huggingFaceEndpoint`)
 *   - bearer-token auth for gated repos (`secureStorage`)
 *   - `AbortSignal` propagation
 *   - typed error classes (`HFGatedError`, `HFNetworkError`)
 *   - per-quant grouping + sharded-file detection
 */

import type { HuggingFaceModel } from '../types'
import type { HFSearchResult } from './types'

export const HF_API_BASE = 'https://huggingface.co/api'
export const GGUF_EXTENSIONS = ['.gguf', '.ggml', '.bin']

export async function searchHuggingFaceModels(
  query: string,
  limit = 20
): Promise<HuggingFaceModel[]> {
  try {
    const searchUrl = `${HF_API_BASE}/models?search=${encodeURIComponent(query)}&filter=gguf&sort=downloads&limit=${limit}`

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.statusText}`)
    }

    const results: HFSearchResult[] = await response.json()

    const models = await Promise.all(
      results.map(async (result) => {
        try {
          const ggufFiles = result.siblings?.filter(file =>
            GGUF_EXTENSIONS.some(ext => file.rfilename.toLowerCase().endsWith(ext))
          ) || []

          if (ggufFiles.length === 0) {
            return null
          }

          const mainFile = ggufFiles.find(f =>
            f.rfilename.toLowerCase().includes('q4') ||
            f.rfilename.toLowerCase().includes('q5')
          ) || ggufFiles[0]

          const quantMatch = mainFile.rfilename.match(/[Qq](\d+)[_-]?([KkMm])?[_-]?([SMLsml])?/i)
          const quantization = quantMatch ? quantMatch[0].toUpperCase() : 'GGUF'

          const contextMatch = result.modelId.match(/(\d+)[kK]/)
          const contextLength = contextMatch ? parseInt(contextMatch[1]) * 1024 : 4096

          const author = result.modelId.split('/')[0]
          const name = result.modelId.split('/')[1]

          return {
            id: result.modelId,
            name: name.replace(/-GGUF$/, ''),
            author,
            downloads: result.downloads || 0,
            likes: result.likes || 0,
            size: mainFile.size / (1024 * 1024 * 1024),
            quantization,
            contextLength,
            tags: result.tags.filter(tag =>
              !tag.startsWith('license:') &&
              !tag.startsWith('region-')
            ).slice(0, 5),
            description: `${name.replace(/-/g, ' ')} - ${quantization} quantized GGUF model`,
            downloadUrl: `https://huggingface.co/${result.modelId}/resolve/main/${mainFile.rfilename}`
          } as HuggingFaceModel
        } catch (error) {
          console.error(`Error processing model ${result.modelId}:`, error)
          return null
        }
      })
    )

    return models.filter((m): m is HuggingFaceModel => m !== null)
  } catch (error) {
    console.error('Error searching HuggingFace:', error)
    throw error
  }
}

export async function getModelFiles(modelId: string): Promise<Array<{ name: string, size: number, url: string }>> {
  try {
    const apiUrl = `${HF_API_BASE}/models/${modelId}`

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch model files: ${response.statusText}`)
    }

    const data: HFSearchResult = await response.json()

    const ggufFiles = data.siblings?.filter(file =>
      GGUF_EXTENSIONS.some(ext => file.rfilename.toLowerCase().endsWith(ext))
    ) || []

    return ggufFiles.map(file => ({
      name: file.rfilename,
      size: file.size,
      url: `https://huggingface.co/${modelId}/resolve/main/${file.rfilename}`
    }))
  } catch (error) {
    console.error('Error fetching model files:', error)
    throw error
  }
}
