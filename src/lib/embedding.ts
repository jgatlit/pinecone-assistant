/**
 * OpenAI embedding generation service
 * Generates vector embeddings for text using OpenAI's embedding models
 */

import OpenAI from 'openai';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

/**
 * Gets or creates the OpenAI client instance
 * Uses lazy initialization to avoid errors if API key is not set
 *
 * @returns OpenAI client instance
 * @throws Error if OPENAI_API_KEY is not set
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY environment variable');
    }

    openaiClient = new OpenAI({
      apiKey,
    });
  }

  return openaiClient;
}

/**
 * Configuration for embedding generation
 */
const EMBEDDING_CONFIG = {
  /** Model to use for embeddings */
  model: 'text-embedding-3-large' as const,
  /** Embedding vector dimensions */
  dimensions: 1536,
  /** Maximum retries on failure */
  maxRetries: 3,
  /** Initial retry delay in milliseconds */
  retryDelayMs: 1000,
} as const;

/**
 * Generates an embedding vector for the given text
 *
 * Uses OpenAI's text-embedding-3-large model with 1536 dimensions
 * for excellent accuracy and semantic understanding.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Input validation
 * - Error handling for API failures
 *
 * @param text - Text to generate embedding for (will be trimmed)
 * @returns Promise resolving to embedding vector (1536 dimensions)
 * @throws Error if text is empty or API calls fail after retries
 *
 * @example
 * ```typescript
 * const embedding = await generateEmbedding("What are workers compensation benefits?");
 * // Returns: [0.123, -0.456, 0.789, ...] (1536 numbers)
 * ```
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const client = getOpenAIClient();
  let lastError: Error | null = null;

  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= EMBEDDING_CONFIG.maxRetries; attempt++) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_CONFIG.model,
        input: trimmedText,
        dimensions: EMBEDDING_CONFIG.dimensions,
      });

      // Extract embedding vector from response
      const embedding = response.data[0]?.embedding;

      if (!embedding) {
        throw new Error('No embedding returned from OpenAI API');
      }

      // Validate embedding dimensions
      if (embedding.length !== EMBEDDING_CONFIG.dimensions) {
        throw new Error(
          `Expected ${EMBEDDING_CONFIG.dimensions} dimensions, got ${embedding.length}`
        );
      }

      return embedding;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors
      if (
        lastError.message.includes('empty text') ||
        lastError.message.includes('dimensions')
      ) {
        throw lastError;
      }

      // Log retry attempt
      if (attempt < EMBEDDING_CONFIG.maxRetries) {
        const delayMs = EMBEDDING_CONFIG.retryDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `Embedding generation failed (attempt ${attempt}/${EMBEDDING_CONFIG.maxRetries}), retrying in ${delayMs}ms...`,
          lastError.message
        );

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Failed to generate embedding after ${EMBEDDING_CONFIG.maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Generates embeddings for multiple texts in batch
 *
 * Processes texts in batches to respect OpenAI API rate limits.
 * Uses the same retry logic as generateEmbedding.
 *
 * @param texts - Array of texts to generate embeddings for
 * @param batchSize - Number of texts to process at once (default: 100)
 * @returns Promise resolving to array of embedding vectors
 * @throws Error if any embedding generation fails
 *
 * @example
 * ```typescript
 * const texts = ["Section 1 content", "Section 2 content"];
 * const embeddings = await generateEmbeddingsBatch(texts);
 * // Returns: [[0.1, 0.2, ...], [0.3, 0.4, ...]]
 * ```
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 100
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const embeddings: number[][] = [];
  const client = getOpenAIClient();

  // Process in batches
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    let lastError: Error | null = null;

    // Retry loop for this batch
    for (let attempt = 1; attempt <= EMBEDDING_CONFIG.maxRetries; attempt++) {
      try {
        const response = await client.embeddings.create({
          model: EMBEDDING_CONFIG.model,
          input: batch,
          dimensions: EMBEDDING_CONFIG.dimensions,
        });

        // Extract embeddings in correct order
        const batchEmbeddings = response.data
          .sort((a, b) => a.index - b.index)
          .map((item) => item.embedding);

        embeddings.push(...batchEmbeddings);
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < EMBEDDING_CONFIG.maxRetries) {
          const delayMs = EMBEDDING_CONFIG.retryDelayMs * Math.pow(2, attempt - 1);
          console.warn(
            `Batch embedding generation failed (attempt ${attempt}/${EMBEDDING_CONFIG.maxRetries}), retrying in ${delayMs}ms...`,
            lastError.message
          );

          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          throw new Error(
            `Failed to generate batch embeddings after ${EMBEDDING_CONFIG.maxRetries} attempts: ${lastError.message}`
          );
        }
      }
    }
  }

  return embeddings;
}

/**
 * Estimates token count for text
 * Uses rough approximation: 1 token ≈ 4 characters
 *
 * @param text - Text to estimate
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
