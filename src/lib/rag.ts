/**
 * Retrieval-Augmented Generation (RAG) utilities
 * Handles vector search and context building for chat responses
 */

import { createAdminSupabaseClient } from './supabase/server';
import type { SearchOptions, DocumentMatch, Citation } from './types';

/**
 * Default search configuration
 *
 * Note: Threshold of 0.45 is appropriate for semantic search over legal case documents.
 * Legal documents queried with natural language questions typically achieve 40-55% similarity.
 * See docs/CLAIMANT_QUERY_ANALYSIS.md for detailed explanation.
 */
const DEFAULT_SEARCH_OPTIONS: Required<SearchOptions> = {
  matchThreshold: 0.45,
  matchCount: 5,
  documentIds: null,
};

/**
 * Searches for relevant document sections using vector similarity
 *
 * Uses Supabase's vector search function to find the most relevant
 * document sections based on cosine similarity of embeddings.
 *
 * @param queryEmbedding - Embedding vector for the search query
 * @param options - Search configuration options
 * @returns Promise resolving to array of matching document sections
 * @throws Error if database query fails
 *
 * @example
 * ```typescript
 * const embedding = await generateEmbedding("What are safety requirements?");
 * const matches = await searchDocuments(embedding, {
 *   matchThreshold: 0.78,
 *   matchCount: 5
 * });
 * ```
 */
export async function searchDocuments(
  queryEmbedding: number[],
  options: SearchOptions = {}
): Promise<DocumentMatch[]> {
  const config = { ...DEFAULT_SEARCH_OPTIONS, ...options };

  try {
    const supabase = await createAdminSupabaseClient();

    const { data, error } = await supabase.rpc('match_sbwc_document_sections', {
      query_embedding: queryEmbedding,
      match_threshold: config.matchThreshold,
      match_count: config.matchCount,
      document_ids: config.documentIds,
    });

    if (error) {
      console.error('Vector search error:', error);
      throw new Error(`Vector search failed: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    return data as DocumentMatch[];
  } catch (error) {
    console.error('Error searching documents:', error);
    throw new Error(
      `Failed to search documents: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Builds context string from document matches for LLM prompt
 *
 * Formats matched document sections into a structured context string
 * that can be included in the system prompt.
 *
 * @param matches - Array of document matches from vector search
 * @returns Formatted context string
 *
 * @example
 * ```typescript
 * const context = buildContext(matches);
 * // Returns:
 * // "Document: safety-manual.pdf
 * // Section: Safety Requirements
 * // Content: All workers must wear...
 * //
 * // Document: training-guide.pdf
 * // ..."
 * ```
 */
export function buildContext(matches: DocumentMatch[]): string {
  if (matches.length === 0) {
    return 'No relevant context found.';
  }

  return matches
    .map((match, index) => {
      const parts: string[] = [
        `--- Source ${index + 1} (Relevance: ${(match.similarity * 100).toFixed(1)}%) ---`,
        `Document: ${match.document_name}`,
      ];

      if (match.heading) {
        parts.push(`Section: ${match.heading}`);
      }

      parts.push(`Content: ${match.content.trim()}`);

      return parts.join('\n');
    })
    .join('\n\n');
}

/**
 * Builds a citation string from matches for response attribution
 *
 * @param matches - Array of document matches
 * @returns Formatted citation string
 *
 * @example
 * ```typescript
 * const citations = buildCitations(matches);
 * // Returns: "Sources: safety-manual.pdf, training-guide.pdf"
 * ```
 */
export function buildCitations(matches: DocumentMatch[]): string {
  if (matches.length === 0) {
    return '';
  }

  const uniqueDocs = Array.from(new Set(matches.map((m) => m.document_name)));
  return `Sources: ${uniqueDocs.join(', ')}`;
}

/**
 * Filters matches by minimum similarity threshold
 *
 * @param matches - Array of document matches
 * @param threshold - Minimum similarity score (0-1)
 * @returns Filtered array of matches
 */
export function filterByThreshold(
  matches: DocumentMatch[],
  threshold: number
): DocumentMatch[] {
  return matches.filter((match) => match.similarity >= threshold);
}

/**
 * Groups matches by document
 *
 * @param matches - Array of document matches
 * @returns Map of document_id to array of matches
 */
export function groupByDocument(
  matches: DocumentMatch[]
): Map<string, DocumentMatch[]> {
  const groups = new Map<string, DocumentMatch[]>();

  for (const match of matches) {
    const existing = groups.get(match.document_id) || [];
    groups.set(match.document_id, [...existing, match]);
  }

  return groups;
}

/**
 * Performs RAG search and returns formatted context
 *
 * Convenience function that combines searchDocuments and buildContext.
 * This is the main entry point for most RAG operations.
 *
 * @param embedding - Query embedding vector (384 dimensions)
 * @param options - Search configuration options
 * @returns Promise resolving to formatted context string and raw matches
 * @throws Error if search fails
 *
 * @example
 * ```typescript
 * const queryEmbedding = await generateEmbedding(userQuestion);
 * const { context, matches } = await performRAGSearch(queryEmbedding);
 *
 * // Use context in LLM prompt
 * const response = await llm.generate({
 *   prompt: `Context:\n${context}\n\nQuestion: ${userQuestion}`
 * });
 * ```
 */
export async function performRAGSearch(
  embedding: number[],
  options: SearchOptions = {}
): Promise<{ context: string; matches: DocumentMatch[] }> {
  const matches = await searchDocuments(embedding, options);
  const context = buildContext(matches);

  return {
    context,
    matches,
  };
}

/**
 * Generates signed URLs for document citations
 *
 * Creates Supabase Storage signed URLs for each unique document in the matches.
 * Handles errors gracefully by setting url to undefined and logging the error.
 *
 * @param matches - Array of document matches from RAG search
 * @param expirySeconds - URL expiry time in seconds (default: 3600 = 1 hour)
 * @returns Promise resolving to array of citation objects with name, url, and relevance
 *
 * @example
 * ```typescript
 * const citations = await generateCitationUrls(matches);
 * // Returns: [
 * //   {
 * //     name: "safety-manual.pdf",
 * //     documentId: "uuid-123",
 * //     url: "https://...",
 * //     relevance: "85.3%"
 * //   }
 * // ]
 * ```
 */
export async function generateCitationUrls(
  matches: DocumentMatch[],
  expirySeconds: number = 3600
): Promise<Citation[]> {
  if (matches.length === 0) {
    return [];
  }

  try {
    const supabase = await createAdminSupabaseClient();

    // Group matches by document to get unique documents
    const documentMap = new Map<string, DocumentMatch>();
    for (const match of matches) {
      if (!documentMap.has(match.document_id)) {
        documentMap.set(match.document_id, match);
      } else {
        // Keep the match with higher similarity
        const existing = documentMap.get(match.document_id)!;
        if (match.similarity > existing.similarity) {
          documentMap.set(match.document_id, match);
        }
      }
    }

    // Generate signed URLs for each unique document
    const citations: Citation[] = [];

    for (const [documentId, match] of Array.from(documentMap.entries())) {
      try {
        const { data, error } = await supabase.storage
          .from('sbwc-documents')
          .createSignedUrl(match.storage_path, expirySeconds);

        if (error) {
          console.error(`Failed to generate signed URL for document ${documentId}:`, error);
          citations.push({
            name: match.document_name,
            documentId,
            url: undefined,
            relevance: `${(match.similarity * 100).toFixed(1)}%`,
            error: error.message,
          });
        } else if (data?.signedUrl) {
          citations.push({
            name: match.document_name,
            documentId,
            url: data.signedUrl,
            relevance: `${(match.similarity * 100).toFixed(1)}%`,
          });
        } else {
          console.error(`No signed URL returned for document ${documentId}`);
          citations.push({
            name: match.document_name,
            documentId,
            url: undefined,
            relevance: `${(match.similarity * 100).toFixed(1)}%`,
            error: 'No signed URL returned',
          });
        }
      } catch (error) {
        console.error(`Error generating signed URL for document ${documentId}:`, error);
        citations.push({
          name: match.document_name,
          documentId,
          url: undefined,
          relevance: `${(match.similarity * 100).toFixed(1)}%`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Sort by relevance (highest first)
    citations.sort((a, b) => {
      const aScore = parseFloat(a.relevance);
      const bScore = parseFloat(b.relevance);
      return bScore - aScore;
    });

    return citations;
  } catch (error) {
    console.error('Error in generateCitationUrls:', error);
    // Return citations without URLs on catastrophic failure
    const uniqueDocs = Array.from(new Set(matches.map(m => m.document_id)));
    return uniqueDocs.map(docId => {
      const match = matches.find(m => m.document_id === docId)!;
      return {
        name: match.document_name,
        documentId: docId,
        url: undefined,
        relevance: `${(match.similarity * 100).toFixed(1)}%`,
        error: 'Failed to generate citations',
      };
    });
  }
}
