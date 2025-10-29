/**
 * Embedding generation utilities
 * Handles text-to-vector conversion using OpenAI's embedding models
 */

import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

/**
 * Generates an embedding vector for the given text using OpenAI's text-embedding-3-small model
 *
 * Uses OpenAI's embedding model to convert text into a 384-dimensional vector
 * for semantic search and similarity matching.
 *
 * @param text - The input text to generate an embedding for
 * @returns Promise resolving to embedding vector (array of numbers)
 * @throws Error if embedding generation fails
 *
 * @example
 * ```typescript
 * const embedding = await generateEmbedding("What are the safety requirements?");
 * // Returns: [0.123, -0.456, 0.789, ...]  (384 dimensions)
 * ```
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot generate embedding for empty text');
    }

    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: text,
    });

    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generates embeddings for multiple texts in batch
 *
 * More efficient than calling generateEmbedding multiple times individually.
 * Useful for processing multiple documents or chunks at once.
 *
 * @param texts - Array of text strings to generate embeddings for
 * @returns Promise resolving to array of embedding vectors
 * @throws Error if batch embedding generation fails
 *
 * @example
 * ```typescript
 * const embeddings = await generateEmbeddingBatch([
 *   "First document text",
 *   "Second document text"
 * ]);
 * // Returns: [[0.123, ...], [0.456, ...]]
 * ```
 */
export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  try {
    if (!texts || texts.length === 0) {
      throw new Error('Cannot generate embeddings for empty array');
    }

    // Filter out empty texts
    const validTexts = texts.filter((t) => t && t.trim().length > 0);

    if (validTexts.length === 0) {
      throw new Error('No valid texts to generate embeddings for');
    }

    // Generate embeddings for all texts
    const embeddings = await Promise.all(validTexts.map((text) => generateEmbedding(text)));

    return embeddings;
  } catch (error) {
    console.error('Error generating batch embeddings:', error);
    throw new Error(
      `Failed to generate batch embeddings: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
