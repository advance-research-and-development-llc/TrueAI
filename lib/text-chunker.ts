export interface TextChunk {
  content: string;
  index: number;
  metadata: {
    start: number;
    end: number;
    characterCount: number;
    wordCount: number;
  };
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
}

export class TextChunker {
  private static readonly DEFAULT_CHUNK_SIZE = 1000;
  private static readonly DEFAULT_OVERLAP = 200;
  private static readonly DEFAULT_SEPARATOR = '\n\n';

  /**
   * Split text into chunks with overlap for context preservation
   */
  static chunkText(text: string, options: ChunkingOptions = {}): TextChunk[] {
    const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;
    const overlap = options.chunkOverlap || this.DEFAULT_OVERLAP;
    const separator = options.separator || this.DEFAULT_SEPARATOR;

    const chunks: TextChunk[] = [];
    const paragraphs = text.split(separator);

    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const testChunk = currentChunk + (currentChunk ? separator : '') + paragraph;

      if (testChunk.length > chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push(this.createChunk(currentChunk, chunkIndex, currentStart));
        chunkIndex++;

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentStart += currentChunk.length - overlapText.length;
        currentChunk = overlapText + separator + paragraph;
      } else {
        currentChunk = testChunk;
      }
    }

    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(currentChunk, chunkIndex, currentStart));
    }

    return chunks;
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private static getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    // Try to find a sentence boundary
    const overlapText = text.slice(-overlapSize);
    const sentenceEnd = overlapText.search(/[.!?]\s/);

    if (sentenceEnd !== -1) {
      return overlapText.slice(sentenceEnd + 2);
    }

    // Try to find a word boundary
    const wordStart = overlapText.indexOf(' ');
    if (wordStart !== -1) {
      return overlapText.slice(wordStart + 1);
    }

    return overlapText;
  }

  /**
   * Create a chunk object with metadata
   */
  private static createChunk(content: string, index: number, start: number): TextChunk {
    const trimmed = content.trim();
    const wordCount = trimmed.split(/\s+/).length;

    return {
      content: trimmed,
      index,
      metadata: {
        start,
        end: start + content.length,
        characterCount: trimmed.length,
        wordCount,
      },
    };
  }

  /**
   * Chunk text by sentences (alternative method)
   */
  static chunkBySentences(text: string, sentencesPerChunk: number = 3): TextChunk[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: TextChunk[] = [];
    let currentStart = 0;

    for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
      const chunkSentences = sentences.slice(i, i + sentencesPerChunk);
      const content = chunkSentences.join(' ').trim();

      chunks.push(this.createChunk(content, Math.floor(i / sentencesPerChunk), currentStart));
      currentStart += content.length;
    }

    return chunks;
  }

  /**
   * Chunk text by word count (alternative method)
   */
  static chunkByWords(text: string, wordsPerChunk: number = 200): TextChunk[] {
    const words = text.split(/\s+/);
    const chunks: TextChunk[] = [];
    let currentStart = 0;

    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const content = chunkWords.join(' ').trim();

      chunks.push(this.createChunk(content, Math.floor(i / wordsPerChunk), currentStart));
      currentStart += content.length;
    }

    return chunks;
  }
}
