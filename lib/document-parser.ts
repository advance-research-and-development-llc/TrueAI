import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export interface ParsedDocument {
  filename: string;
  type: string;
  size: number;
  content: string;
  metadata: Record<string, any>;
}

export class DocumentParser {
  /**
   * Pick a document using Expo's document picker
   */
  static async pickDocument(): Promise<DocumentPicker.DocumentPickerResult> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/pdf', 'text/*'],
        copyToCacheDirectory: true,
      });
      return result;
    } catch (error) {
      console.error('Error picking document:', error);
      throw error;
    }
  }

  /**
   * Parse a document based on its MIME type
   */
  static async parseDocument(uri: string, mimeType: string, name: string): Promise<ParsedDocument> {
    try {
      let content = '';
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      // Handle different file types
      if (mimeType === 'text/plain' || mimeType.startsWith('text/')) {
        content = await this.parseTextFile(uri);
      } else if (mimeType === 'application/pdf') {
        content = await this.parsePDFFile(uri);
      } else {
        // Try to read as text anyway
        try {
          content = await this.parseTextFile(uri);
        } catch {
          throw new Error(`Unsupported file type: ${mimeType}`);
        }
      }

      return {
        filename: name,
        type: mimeType,
        size,
        content,
        metadata: {
          parsedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error parsing document:', error);
      throw error;
    }
  }

  /**
   * Parse a plain text file
   */
  private static async parseTextFile(uri: string): Promise<string> {
    try {
      const content = await FileSystem.readAsStringAsync(uri);
      return content;
    } catch (error) {
      console.error('Error parsing text file:', error);
      throw error;
    }
  }

  /**
   * Parse a PDF file using react-native-pdf-lib
   * Note: This requires react-native-pdf-lib to be properly configured
   */
  private static async parsePDFFile(uri: string): Promise<string> {
    try {
      // Attempt to use react-native-pdf-lib if available
      try {
        const PDFLib = require('react-native-pdf-lib');

        // Read the PDF file
        const pdfContent = await PDFLib.getPageText(uri, 0); // Get first page as test

        // For a complete implementation, iterate through all pages
        // This is a simplified version that reads the first few pages
        const maxPages = 10; // Limit to avoid performance issues
        const pages: string[] = [];

        for (let i = 0; i < maxPages; i++) {
          try {
            const pageText = await PDFLib.getPageText(uri, i);
            if (pageText && pageText.trim()) {
              pages.push(pageText);
            } else {
              break; // No more pages
            }
          } catch {
            break; // Reached end of document
          }
        }

        if (pages.length > 0) {
          return pages.join('\n\n--- Page Break ---\n\n');
        }
      } catch (pdfLibError) {
        console.warn('react-native-pdf-lib not available or failed:', pdfLibError);
      }

      // Fallback: Read PDF as base64 and provide basic info
      // This doesn't extract text but at least provides the file data
      const content = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Basic metadata extraction
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      return `[PDF Document]
File Size: ${Math.round(size / 1024)} KB
Base64 Length: ${content.length}

Note: Full text extraction requires react-native-pdf-lib to be properly configured.
For production use, consider:
1. Configuring react-native-pdf-lib for native PDF parsing
2. Using a cloud service (Google Cloud Vision, AWS Textract)
3. Implementing server-side PDF parsing

Base64 data is available but not displayed here for brevity.`;
    } catch (error) {
      console.error('Error parsing PDF file:', error);
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate if a file type is supported
   */
  static isSupportedType(mimeType: string): boolean {
    const supported = [
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/pdf',
    ];
    return supported.includes(mimeType) || mimeType.startsWith('text/');
  }

  /**
   * Extract text from various sources
   */
  static async extractTextFromSource(
    source: 'file' | 'text' | 'conversation',
    data: any
  ): Promise<string> {
    switch (source) {
      case 'text':
        return data as string;
      case 'conversation':
        // Extract text from conversation messages
        return data
          .map((msg: any) => `${msg.role}: ${msg.content}`)
          .join('\n\n');
      case 'file':
        // Already parsed
        return data;
      default:
        throw new Error(`Unsupported source: ${source}`);
    }
  }
}
