'use server';

/**
 * Server actions for chat interface
 * Implements RAG-powered chat using Supabase vector search and OpenAI
 * Includes LangSmith tracing for monitoring and debugging
 */

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createStreamableValue } from 'ai/rsc';
import { generateEmbedding } from '@/lib/embedding';
import { performRAGSearch, generateCitationUrls } from '@/lib/rag';
import { traceable } from 'langsmith/traceable';
import { wrapOpenAI } from 'langsmith/wrappers';
import type { Citation } from '@/lib/types';

/**
 * Message type for chat interface
 */
type Message = {
  role: 'system' | 'user' | 'assistant' | 'function' | 'data' | 'tool';
  content: string;
};

/**
 * System prompt template for RAG-powered assistant
 */
const SYSTEM_PROMPT_TEMPLATE = `You are a helpful and knowledgeable assistant for SBWC (State Board of Workers' Compensation). Your role is to answer questions about workers' compensation policies, procedures, safety regulations, and related topics using the provided context from official documents.

## Context from Documents

{context}

## Instructions

- **Answer based on the provided context**: Use the information from the context above to answer the user's question accurately and completely.
- **Cite sources naturally**: When referencing specific information, mention which document it comes from (e.g., "According to the Safety Manual..." or "As stated in Case 2020042077..."). Document names will automatically appear as clickable links below your response.
- **Be transparent**: If the answer is not found in the provided context, clearly state: "I don't have information about that in the available documents."
- **Be concise and clear**: Provide direct answers without unnecessary elaboration, but include important details.
- **Be professional**: Maintain a helpful, professional tone appropriate for workplace safety and legal compliance topics.
- **Indicate relevance**: If the context is only partially relevant, acknowledge this and answer what you can.
- **Don't make assumptions**: Only use information explicitly stated in the context. Don't infer or extrapolate beyond what's written.
- **Source attribution**: All documents consulted to answer this question will be automatically listed with downloadable links below your response. You don't need to list sources separately - focus on providing a clear, well-reasoned answer.

{citations}`;

/**
 * Traced RAG search function
 * Wrapped with LangSmith tracing for monitoring vector search performance
 *
 * Note: Threshold of 0.45 is appropriate for semantic search over legal case documents.
 * Legal documents queried with natural language questions typically achieve 40-55% similarity.
 */
const tracedRAGSearch = traceable(
  async (embedding: number[], query: string) => {
    return await performRAGSearch(embedding, {
      matchThreshold: 0.45,
      matchCount: 5,
      documentIds: null,
    });
  },
  {
    name: 'rag_vector_search',
    tags: ['rag', 'vector-search', 'supabase'],
  }
);

/**
 * Traced embedding generation
 * Wrapped with LangSmith tracing for monitoring embedding API calls
 */
const tracedGenerateEmbedding = traceable(
  async (text: string) => {
    return await generateEmbedding(text);
  },
  {
    name: 'generate_embedding',
    tags: ['embedding', 'openai'],
  }
);


/**
 * chat - Server action for RAG-powered chat streaming
 *
 * Process:
 * 1. Extract last user message
 * 2. Generate embedding for the query (traced with LangSmith)
 * 3. Search for relevant document sections using vector similarity (traced)
 * 4. Build context from matched sections
 * 5. Generate signed URLs for document citations
 * 6. Create system prompt with context
 * 7. Stream AI response using Vercel AI SDK (traced)
 *
 * @param messages - Array of chat messages
 * @returns Object containing streamable value for AI response chunks and citations array
 *
 * @example
 * ```typescript
 * const { object, citations } = await chat([
 *   { role: 'user', content: 'What are the safety requirements?' }
 * ]);
 *
 * // Stream the response
 * for await (const chunk of object) {
 *   console.log(chunk);
 * }
 *
 * // Display citations with clickable URLs
 * citations.forEach(citation => {
 *   console.log(`${citation.name} (${citation.relevance}): ${citation.url}`);
 * });
 * ```
 */
export const chat = traceable(
  async (messages: Message[]) => {
  try {
    // Validate input
    if (!messages || messages.length === 0) {
      throw new Error('No messages provided');
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || !lastMessage.content) {
      throw new Error('Invalid message format');
    }

    // Generate embedding for the query (traced)
    const embedding = await tracedGenerateEmbedding(lastMessage.content);

    // Search for relevant document sections (traced)
    const { context, matches } = await tracedRAGSearch(embedding, lastMessage.content);

    // Generate signed URLs for citations
    const citations = await generateCitationUrls(matches);

    // Build citations string for system prompt
    const uniqueSources = matches.length > 0
      ? Array.from(new Set(matches.map((m) => m.document_name)))
      : [];
    const citationsText =
      uniqueSources.length > 0
        ? `\n\n**Sources consulted**: ${uniqueSources.join(', ')}`
        : '';

    // Create system message with context
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{context}', context).replace(
      '{citations}',
      citationsText
    );

    const systemMessage: Message = {
      role: 'system',
      content: systemPrompt,
    };

    // Create streamable value for response
    const stream = createStreamableValue();

    // Start streaming in the background
    (async () => {
      try {
        const result = await streamText({
          model: openai('gpt-4o'),
          messages: [systemMessage, ...messages],
          temperature: 0.7,
          maxTokens: 1000,
        });

        // Stream chunks to the client
        for await (const chunk of result.textStream) {
          stream.update(chunk);
        }

        // Close stream when complete
        stream.done();
      } catch (error) {
        console.error('Streaming error:', error);
        stream.error(error instanceof Error ? error.message : 'Streaming failed');
      }
    })();

    return { object: stream.value, citations };
  } catch (error) {
    console.error('Chat action error:', error);

    // Create error stream
    const errorStream = createStreamableValue();
    errorStream.error(
      error instanceof Error
        ? error.message
        : 'An error occurred while processing your request'
    );

    return { object: errorStream.value, citations: [] };
  }
},
{
  name: 'chat_with_rag',
  tags: ['chat', 'rag', 'sbwc'],
  metadata: {
    model: 'gpt-4o',
    framework: 'vercel-ai-sdk',
    database: 'supabase',
  },
}
);
