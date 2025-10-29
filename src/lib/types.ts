/**
 * Type definitions for RAG system
 */

/**
 * Options for vector search queries
 */
export interface SearchOptions {
  /** Minimum similarity threshold (0-1) */
  matchThreshold?: number;
  /** Maximum number of matches to return */
  matchCount?: number;
  /** Filter by specific document IDs (null to search all documents) */
  documentIds?: string[] | null;
}

/**
 * Document section match from vector search
 */
export interface DocumentMatch {
  /** Section record ID */
  id: number;
  /** Parent document ID */
  document_id: string;
  /** Section text content */
  content: string;
  /** Section heading (if applicable) */
  heading: string | null;
  /** Similarity score (0-1) */
  similarity: number;
  /** Parent document name */
  document_name: string;
  /** Storage path for document (used to generate signed URLs) */
  storage_path: string;
}

/**
 * Document processing result
 */
export interface ProcessedDocument {
  /** Document ID */
  id: string;
  /** Document name */
  name: string;
  /** Storage path */
  storage_path: string;
  /** Number of sections created */
  sections_count: number;
  /** Upload timestamp */
  uploaded_at: string;
  /** Processing status (for async PDF processing) */
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Document chunk for processing
 */
export interface DocumentChunk {
  /** Chunk text content */
  content: string;
  /** Section heading (if extracted) */
  heading: string | null;
  /** Token count estimate */
  tokenCount: number;
}

/**
 * Citation for source attribution in chat responses
 */
export interface Citation {
  /** Document name */
  name: string;
  /** Document ID */
  documentId: string;
  /** Signed URL for document access (undefined if generation failed) */
  url: string | undefined;
  /** Relevance score as percentage string (e.g., "85.3%") */
  relevance: string;
  /** Error message if URL generation failed */
  error?: string;
}
