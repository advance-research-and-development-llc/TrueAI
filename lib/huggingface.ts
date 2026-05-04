/**
 * HuggingFace Model Hub Integration
 *
 * Provides search and download capabilities for GGUF models from HuggingFace
 */

import axios from 'axios';
import * as FileSystem from 'expo-file-system';

export interface HuggingFaceModel {
  id: string;
  modelId: string;
  author: string;
  name: string;
  likes: number;
  downloads: number;
  tags: string[];
  pipeline_tag?: string;
  library_name?: string;
  files?: HuggingFaceFile[];
}

export interface HuggingFaceFile {
  rfilename: string;
  size: number;
  lfs?: {
    oid: string;
    size: number;
    pointerSize: number;
  };
}

export interface DownloadProgress {
  progress: number;
  bytesWritten: number;
  totalBytes: number;
}

export class HuggingFaceService {
  private baseUrl = 'https://huggingface.co';
  private apiUrl = 'https://huggingface.co/api';

  /**
   * Search for GGUF models on HuggingFace
   */
  async searchModels(
    query: string = '',
    options: {
      limit?: number;
      filter?: string;
      sort?: 'likes' | 'downloads' | 'updated';
    } = {}
  ): Promise<HuggingFaceModel[]> {
    try {
      const params = new URLSearchParams({
        search: query,
        filter: options.filter || 'gguf',
        sort: options.sort || 'downloads',
        direction: '-1',
        limit: String(options.limit || 20),
      });

      const response = await axios.get(`${this.apiUrl}/models?${params.toString()}`);

      return response.data.map((model: any) => ({
        id: model.id || model._id,
        modelId: model.modelId || model.id,
        author: model.author || model.id?.split('/')[0],
        name: model.id?.split('/')[1] || model.id,
        likes: model.likes || 0,
        downloads: model.downloads || 0,
        tags: model.tags || [],
        pipeline_tag: model.pipeline_tag,
        library_name: model.library_name,
      }));
    } catch (error) {
      console.error('HuggingFace search error:', error);
      throw new Error('Failed to search HuggingFace models');
    }
  }

  /**
   * Get model files list
   */
  async getModelFiles(modelId: string): Promise<HuggingFaceFile[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/models/${modelId}/tree/main`);

      // Filter for GGUF files
      const files = response.data
        .filter((file: any) => file.path?.endsWith('.gguf'))
        .map((file: any) => ({
          rfilename: file.path,
          size: file.size || 0,
          lfs: file.lfs,
        }));

      return files;
    } catch (error) {
      console.error('Error fetching model files:', error);
      throw new Error('Failed to fetch model files');
    }
  }

  /**
   * Download a GGUF model file from HuggingFace
   */
  async downloadModel(
    modelId: string,
    filename: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    try {
      const downloadUrl = `${this.baseUrl}/${modelId}/resolve/main/${filename}`;
      const localPath = `${FileSystem.documentDirectory}models/${filename}`;

      // Create models directory if it doesn't exist
      const modelsDir = `${FileSystem.documentDirectory}models`;
      const dirInfo = await FileSystem.getInfoAsync(modelsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(modelsDir, { intermediates: true });
      }

      // Download with progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localPath,
        {},
        (downloadProgress) => {
          if (onProgress) {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            onProgress({
              progress: progress * 100,
              bytesWritten: downloadProgress.totalBytesWritten,
              totalBytes: downloadProgress.totalBytesExpectedToWrite,
            });
          }
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (!result) {
        throw new Error('Download failed');
      }

      return result.uri;
    } catch (error) {
      console.error('Download error:', error);
      throw new Error('Failed to download model');
    }
  }

  /**
   * Get popular GGUF models
   */
  async getPopularModels(): Promise<HuggingFaceModel[]> {
    return this.searchModels('', {
      limit: 20,
      filter: 'gguf',
      sort: 'downloads',
    });
  }

  /**
   * Get model info
   */
  async getModelInfo(modelId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/models/${modelId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching model info:', error);
      throw new Error('Failed to fetch model information');
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Extract quantization from filename
   */
  getQuantizationFromFilename(filename: string): string {
    const patterns = [
      /Q(\d+_K_[MS])/i,
      /Q(\d+_\d+)/i,
      /Q(\d+)/i,
      /(f16|f32)/i,
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }

    return 'Unknown';
  }
}

export const huggingFaceService = new HuggingFaceService();
