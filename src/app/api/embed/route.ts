/**
 * Embedding generation endpoint
 * Generates vector embeddings for text using OpenAI
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/embedding';

export const maxDuration = 30;

/**
 * POST /api/embed
 *
 * Generates an embedding vector for the provided text
 *
 * Use cases:
 * - Client-side embedding generation for search queries
 * - Testing embedding generation
 * - Custom embedding workflows
 *
 * Authentication: Optional (rate limiting recommended in production)
 *
 * @param request - Next.js request with JSON body
 * @returns Embedding vector
 *
 * @example Request:
 * ```json
 * {
 *   "text": "What are the safety requirements for workers?"
 * }
 * ```
 *
 * @example Response (200 OK):
 * ```json
 * {
 *   "status": "success",
 *   "embedding": [0.123, -0.456, 0.789, ...],
 *   "dimensions": 384,
 *   "model": "text-embedding-3-small"
 * }
 * ```
 *
 * @example Response (400 Bad Request):
 * ```json
 * {
 *   "status": "error",
 *   "message": "Text is required"
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { text } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Text is required and must be a string',
        },
        { status: 400 }
      );
    }

    const trimmedText = text.trim();

    if (trimmedText.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Text cannot be empty',
        },
        { status: 400 }
      );
    }

    // Validate text length (reasonable limit)
    const maxLength = 8000; // ~2000 tokens
    if (trimmedText.length > maxLength) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Text too long. Maximum length: ${maxLength} characters`,
        },
        { status: 400 }
      );
    }

    // Generate embedding
    const embedding = await generateEmbedding(trimmedText);

    return NextResponse.json(
      {
        status: 'success',
        embedding,
        dimensions: embedding.length,
        model: 'text-embedding-3-small',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Embedding generation error:', error);

    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Embedding generation failed',
      },
      { status: 500 }
    );
  }
}
