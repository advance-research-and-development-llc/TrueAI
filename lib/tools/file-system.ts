/**
 * File System Tools
 * Provides cross-platform file operations using expo-file-system
 */

import * as FileSystem from 'expo-file-system';

export interface ListFilesParams {
  path: string;
}

export interface ListFilesResponse {
  files: string[];
  path: string;
  count: number;
}

export interface ReadFileParams {
  path: string;
}

export interface ReadFileResponse {
  content: string;
  path: string;
  size: number;
}

export interface WriteFileParams {
  path: string;
  content: string;
}

export interface WriteFileResponse {
  success: boolean;
  path: string;
  message: string;
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modificationTime: number;
}

/**
 * List files in a directory
 */
export async function listFiles(params: ListFilesParams): Promise<ListFilesResponse> {
  try {
    const { path } = params;

    // Resolve path relative to document directory if not absolute
    const fullPath = path.startsWith('file://') ? path : `${FileSystem.documentDirectory}${path}`;

    // Check if directory exists
    const info = await FileSystem.getInfoAsync(fullPath);
    if (!info.exists) {
      return {
        files: [],
        path: fullPath,
        count: 0,
      };
    }

    // Read directory contents
    const files = await FileSystem.readDirectoryAsync(fullPath);

    return {
      files,
      path: fullPath,
      count: files.length,
    };
  } catch (error) {
    console.error('List files error:', error);
    return {
      files: [],
      path: params.path,
      count: 0,
    };
  }
}

/**
 * Get detailed file information
 */
export async function getFileInfo(path: string): Promise<FileInfo | null> {
  try {
    const fullPath = path.startsWith('file://') ? path : `${FileSystem.documentDirectory}${path}`;

    const info = await FileSystem.getInfoAsync(fullPath, { size: true, md5: false });

    if (!info.exists) {
      return null;
    }

    return {
      name: path.split('/').pop() || path,
      path: fullPath,
      size: info.size || 0,
      isDirectory: info.isDirectory || false,
      modificationTime: info.modificationTime || 0,
    };
  } catch (error) {
    console.error('Get file info error:', error);
    return null;
  }
}

/**
 * Read file contents as text
 */
export async function readFile(params: ReadFileParams): Promise<ReadFileResponse> {
  try {
    const { path } = params;

    // Resolve path relative to document directory if not absolute
    const fullPath = path.startsWith('file://') ? path : `${FileSystem.documentDirectory}${path}`;

    // Check if file exists
    const info = await FileSystem.getInfoAsync(fullPath, { size: true });
    if (!info.exists) {
      return {
        content: '',
        path: fullPath,
        size: 0,
      };
    }

    // Read file content
    const content = await FileSystem.readAsStringAsync(fullPath);

    return {
      content,
      path: fullPath,
      size: info.size || 0,
    };
  } catch (error) {
    console.error('Read file error:', error);
    return {
      content: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      path: params.path,
      size: 0,
    };
  }
}

/**
 * Write content to a file
 */
export async function writeFile(params: WriteFileParams): Promise<WriteFileResponse> {
  try {
    const { path, content } = params;

    // Resolve path relative to document directory if not absolute
    const fullPath = path.startsWith('file://') ? path : `${FileSystem.documentDirectory}${path}`;

    // Write file
    await FileSystem.writeAsStringAsync(fullPath, content);

    return {
      success: true,
      path: fullPath,
      message: 'File written successfully',
    };
  } catch (error) {
    console.error('Write file error:', error);
    return {
      success: false,
      path: params.path,
      message: `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Delete a file or directory
 */
export async function deleteFile(path: string): Promise<{ success: boolean; message: string }> {
  try {
    const fullPath = path.startsWith('file://') ? path : `${FileSystem.documentDirectory}${path}`;

    const info = await FileSystem.getInfoAsync(fullPath);
    if (!info.exists) {
      return {
        success: false,
        message: 'File or directory does not exist',
      };
    }

    await FileSystem.deleteAsync(fullPath);

    return {
      success: true,
      message: 'File deleted successfully',
    };
  } catch (error) {
    console.error('Delete file error:', error);
    return {
      success: false,
      message: `Error deleting file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Create a directory
 */
export async function createDirectory(path: string): Promise<{ success: boolean; message: string }> {
  try {
    const fullPath = path.startsWith('file://') ? path : `${FileSystem.documentDirectory}${path}`;

    await FileSystem.makeDirectoryAsync(fullPath, { intermediates: true });

    return {
      success: true,
      message: 'Directory created successfully',
    };
  } catch (error) {
    console.error('Create directory error:', error);
    return {
      success: false,
      message: `Error creating directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get app document directory path
 */
export function getDocumentDirectory(): string {
  return FileSystem.documentDirectory || '';
}

/**
 * Get app cache directory path
 */
export function getCacheDirectory(): string {
  return FileSystem.cacheDirectory || '';
}
