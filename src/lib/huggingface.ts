import type { HuggingFaceModel } from './types'

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

const HF_API_BASE = 'https://huggingface.co/api'
const GGUF_EXTENSIONS = ['.gguf', '.ggml', '.bin']

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

export async function getModelFiles(modelId: string): Promise<Array<{name: string, size: number, url: string}>> {
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

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

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
