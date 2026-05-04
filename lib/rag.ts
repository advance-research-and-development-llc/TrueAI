import { supabase, Database } from './supabase';
import { DocumentParser } from './document-parser';
import { TextChunker, TextChunk } from './text-chunker';
import { EmbeddingService } from './embeddings';

type KnowledgeBase = Database['public']['Tables']['knowledge_bases']['Row'];
type KnowledgeDocument = Database['public']['Tables']['knowledge_documents']['Row'];
type KnowledgeChunk = Database['public']['Tables']['knowledge_chunks']['Row'];

export interface RAGQuery {
  query: string;
  knowledgeBaseIds?: string[];
  topK?: number;
  similarityThreshold?: number;
}

export interface RAGResult {
  chunks: Array<{
    content: string;
    similarity: number;
    metadata: Record<string, any>;
    documentName?: string;
  }>;
  context: string;
}

export class RAGService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Create a new knowledge base
   */
  async createKnowledgeBase(
    userId: string,
    name: string,
    description: string | null,
    type: 'document' | 'text' | 'conversation' | 'neuron_packet'
  ): Promise<KnowledgeBase> {
    const { data, error } = await supabase
      .from('knowledge_bases')
      .insert({
        user_id: userId,
        name,
        description,
        type,
        status: 'active',
        document_count: 0,
        chunk_count: 0,
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Add a document to a knowledge base
   */
  async addDocument(
    knowledgeBaseId: string,
    uri: string,
    filename: string,
    mimeType: string,
    ollamaUrl?: string
  ): Promise<KnowledgeDocument> {
    try {
      // Parse the document
      const parsed = await DocumentParser.parseDocument(uri, mimeType, filename);

      // Create document record
      const { data: document, error: docError } = await supabase
        .from('knowledge_documents')
        .insert({
          knowledge_base_id: knowledgeBaseId,
          filename: parsed.filename,
          file_type: parsed.type,
          file_size: parsed.size,
          status: 'processing',
          chunk_count: 0,
          metadata: parsed.metadata,
        })
        .select()
        .single();

      if (docError) throw docError;

      // Chunk the text
      const chunks = TextChunker.chunkText(parsed.content, {
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      // Generate embeddings and store chunks
      const chunkInserts = [];
      for (const chunk of chunks) {
        const embedding = ollamaUrl
          ? await this.embeddingService.generateOllamaEmbedding(chunk.content, ollamaUrl)
          : await this.embeddingService.generateEmbedding(chunk.content);

        chunkInserts.push({
          knowledge_base_id: knowledgeBaseId,
          document_id: document.id,
          content: chunk.content,
          chunk_index: chunk.index,
          embedding: embedding.embedding,
          metadata: chunk.metadata,
        });
      }

      // Insert all chunks
      const { error: chunkError } = await supabase
        .from('knowledge_chunks')
        .insert(chunkInserts);

      if (chunkError) throw chunkError;

      // Update document status
      const { data: updated, error: updateError } = await supabase
        .from('knowledge_documents')
        .update({
          status: 'completed',
          chunk_count: chunks.length,
        })
        .eq('id', document.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update knowledge base counts
      await this.updateKnowledgeBaseCounts(knowledgeBaseId);

      return updated;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  /**
   * Add text directly to a knowledge base
   */
  async addText(
    knowledgeBaseId: string,
    text: string,
    title: string,
    ollamaUrl?: string
  ): Promise<void> {
    try {
      // Create document record
      const { data: document, error: docError } = await supabase
        .from('knowledge_documents')
        .insert({
          knowledge_base_id: knowledgeBaseId,
          filename: title,
          file_type: 'text/plain',
          file_size: text.length,
          status: 'processing',
          chunk_count: 0,
          metadata: { source: 'direct_text' },
        })
        .select()
        .single();

      if (docError) throw docError;

      // Chunk the text
      const chunks = TextChunker.chunkText(text, {
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      // Generate embeddings and store chunks
      const chunkInserts = [];
      for (const chunk of chunks) {
        const embedding = ollamaUrl
          ? await this.embeddingService.generateOllamaEmbedding(chunk.content, ollamaUrl)
          : await this.embeddingService.generateEmbedding(chunk.content);

        chunkInserts.push({
          knowledge_base_id: knowledgeBaseId,
          document_id: document.id,
          content: chunk.content,
          chunk_index: chunk.index,
          embedding: embedding.embedding,
          metadata: chunk.metadata,
        });
      }

      // Insert all chunks
      const { error: chunkError } = await supabase
        .from('knowledge_chunks')
        .insert(chunkInserts);

      if (chunkError) throw chunkError;

      // Update document status
      await supabase
        .from('knowledge_documents')
        .update({
          status: 'completed',
          chunk_count: chunks.length,
        })
        .eq('id', document.id);

      // Update knowledge base counts
      await this.updateKnowledgeBaseCounts(knowledgeBaseId);
    } catch (error) {
      console.error('Error adding text:', error);
      throw error;
    }
  }

  /**
   * Query knowledge bases for relevant context
   */
  async query(params: RAGQuery, ollamaUrl?: string): Promise<RAGResult> {
    const { query, knowledgeBaseIds, topK = 5, similarityThreshold = 0.3 } = params;

    try {
      // Generate query embedding
      const queryEmbedding = ollamaUrl
        ? await this.embeddingService.generateOllamaEmbedding(query, ollamaUrl)
        : await this.embeddingService.generateEmbedding(query);

      // Fetch chunks from specified knowledge bases
      let chunksQuery = supabase
        .from('knowledge_chunks')
        .select(`
          *,
          knowledge_documents!inner(filename)
        `);

      if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
        chunksQuery = chunksQuery.in('knowledge_base_id', knowledgeBaseIds);
      }

      const { data: chunks, error } = await chunksQuery;

      if (error) throw error;

      // Calculate similarities and rank chunks
      const rankedChunks = chunks
        .map(chunk => ({
          content: chunk.content,
          similarity: chunk.embedding
            ? EmbeddingService.cosineSimilarity(queryEmbedding.embedding, chunk.embedding)
            : 0,
          metadata: chunk.metadata,
          documentName: (chunk.knowledge_documents as any)?.filename,
        }))
        .filter(chunk => chunk.similarity >= similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      // Build context from top chunks
      const context = rankedChunks
        .map(
          (chunk, idx) =>
            `[Source ${idx + 1}: ${chunk.documentName}]\n${chunk.content}\n`
        )
        .join('\n---\n\n');

      return {
        chunks: rankedChunks,
        context,
      };
    } catch (error) {
      console.error('Error querying RAG:', error);
      throw error;
    }
  }

  /**
   * List all knowledge bases for a user
   */
  async listKnowledgeBases(userId: string): Promise<KnowledgeBase[]> {
    const { data, error } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Delete a knowledge base and all its data
   */
  async deleteKnowledgeBase(knowledgeBaseId: string): Promise<void> {
    // Delete chunks
    await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('knowledge_base_id', knowledgeBaseId);

    // Delete documents
    await supabase
      .from('knowledge_documents')
      .delete()
      .eq('knowledge_base_id', knowledgeBaseId);

    // Delete knowledge base
    const { error } = await supabase
      .from('knowledge_bases')
      .delete()
      .eq('id', knowledgeBaseId);

    if (error) throw error;
  }

  /**
   * Update knowledge base counts
   */
  private async updateKnowledgeBaseCounts(knowledgeBaseId: string): Promise<void> {
    // Count documents
    const { count: docCount } = await supabase
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true })
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('status', 'completed');

    // Count chunks
    const { count: chunkCount } = await supabase
      .from('knowledge_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('knowledge_base_id', knowledgeBaseId);

    // Update knowledge base
    await supabase
      .from('knowledge_bases')
      .update({
        document_count: docCount || 0,
        chunk_count: chunkCount || 0,
      })
      .eq('id', knowledgeBaseId);
  }
}

// Singleton instance
let ragService: RAGService | null = null;

export function getRAGService(): RAGService {
  if (!ragService) {
    ragService = new RAGService();
  }
  return ragService;
}
