/**
 * Simple embedding service using TF-IDF-like approach
 * For production, consider using:
 * - Ollama embeddings API
 * - Transformers.js for local embeddings
 * - External embedding API (OpenAI, Cohere, etc.)
 */

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
}

export class EmbeddingService {
  private vocabulary: Map<string, number> = new Map();
  private idfScores: Map<string, number> = new Map();
  private documentCount: number = 0;

  /**
   * Generate a simple embedding using TF-IDF approach
   * This is a basic implementation - for production use proper embeddings
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const words = this.tokenize(text);
    const termFrequency = this.calculateTermFrequency(words);

    // Create a fixed-size embedding vector (256 dimensions)
    const dimensions = 256;
    const embedding = new Array(dimensions).fill(0);

    // Map words to embedding dimensions using a simple hash
    for (const [word, tf] of termFrequency.entries()) {
      const hash = this.simpleHash(word);
      const index = hash % dimensions;
      const idf = this.idfScores.get(word) || 1;
      embedding[index] += tf * idf;
    }

    // Normalize the embedding vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalized = magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;

    return {
      embedding: normalized,
      dimensions,
    };
  }

  /**
   * Generate embeddings using Ollama (if available)
   */
  async generateOllamaEmbedding(text: string, ollamaUrl: string): Promise<EmbeddingResult> {
    try {
      const response = await fetch(`${ollamaUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error('Ollama embedding request failed');
      }

      const data = await response.json();
      return {
        embedding: data.embedding || data.embeddings?.[0],
        dimensions: data.embedding?.length || data.embeddings?.[0]?.length || 0,
      };
    } catch (error) {
      console.warn('Ollama embedding failed, falling back to simple embeddings:', error);
      return this.generateEmbedding(text);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Update IDF scores based on document corpus
   */
  updateIDF(documents: string[]): void {
    this.documentCount = documents.length;
    const documentFrequency = new Map<string, number>();

    // Count document frequency for each word
    for (const doc of documents) {
      const words = new Set(this.tokenize(doc));
      for (const word of words) {
        documentFrequency.set(word, (documentFrequency.get(word) || 0) + 1);
      }
    }

    // Calculate IDF scores
    for (const [word, df] of documentFrequency.entries()) {
      this.idfScores.set(word, Math.log(this.documentCount / df));
    }
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2); // Filter out very short words
  }

  /**
   * Calculate term frequency
   */
  private calculateTermFrequency(words: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    const totalWords = words.length;

    for (const word of words) {
      tf.set(word, (tf.get(word) || 0) + 1);
    }

    // Normalize by total word count
    for (const [word, count] of tf.entries()) {
      tf.set(word, count / totalWords);
    }

    return tf;
  }

  /**
   * Simple hash function for consistent word-to-index mapping
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
