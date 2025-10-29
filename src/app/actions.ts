'use server';

/**
 * Server actions for chat interface
 * Implements RAG-powered chat using Supabase vector search and OpenAI
 * Includes LangSmith tracing for monitoring and debugging
 * Includes chat session and message history persistence
 */

import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createStreamableValue } from 'ai/rsc';
import { generateEmbedding } from '@/lib/embedding';
import { performRAGSearch, generateCitationUrls } from '@/lib/rag';
import { traceable } from 'langsmith/traceable';
import { wrapOpenAI } from 'langsmith/wrappers';
import type { Citation } from '@/lib/types';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

/**
 * Message type for chat interface
 */
type Message = {
  role: 'system' | 'user' | 'assistant' | 'function' | 'data' | 'tool';
  content: string;
};

/**
 * Extended message type with metadata for frontend
 */
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  references?: Reference[];
};

/**
 * Reference type for document citations
 */
export type Reference = {
  name: string;
  url: string | undefined;
  relevance: string;
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
 * Gets or creates a chat session for the current authenticated user
 *
 * Checks for an existing active session (most recent by updated_at) and returns it,
 * or creates a new session if none exists. Handles authentication gracefully.
 *
 * @returns Promise resolving to session ID or null if authentication fails
 *
 * @example
 * ```typescript
 * const sessionId = await getOrCreateSession();
 * if (!sessionId) {
 *   // Handle unauthenticated state
 *   return;
 * }
 * ```
 */
export async function getOrCreateSession(): Promise<string | null> {
  try {
    const supabase = await createAdminSupabaseClient();

    // For now, use a fixed user ID (temporary until auth is implemented)
    // TODO: Replace with actual user authentication
    const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

    // Check for existing active session (most recent)
    const { data: existingSessions, error: fetchError } = await supabase
      .from('sbwc_chat_sessions')
      .select('id')
      .eq('user_id', DEFAULT_USER_ID)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching sessions:', fetchError);
      // Fall through to create new session
    }

    // Return existing session if found
    if (existingSessions && existingSessions.length > 0) {
      return existingSessions[0].id;
    }

    // Create new session
    const { data: newSession, error: createError } = await supabase
      .from('sbwc_chat_sessions')
      .insert({
        user_id: DEFAULT_USER_ID,
        title: 'New Chat',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {},
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating session:', createError);
      return null;
    }

    return newSession?.id || null;
  } catch (error) {
    console.error('Unexpected error in getOrCreateSession:', error);
    return null;
  }
}

/**
 * Loads message history for a specific chat session
 *
 * Fetches all messages for the given session ID, ordered chronologically.
 * Transforms database format to frontend ChatMessage type including references.
 * Returns empty array on error for graceful degradation.
 *
 * @param sessionId - The chat session ID to load messages for
 * @returns Promise resolving to array of ChatMessage objects
 *
 * @example
 * ```typescript
 * const messages = await loadMessageHistory(sessionId);
 * // Returns: [
 * //   {
 * //     id: "msg-123",
 * //     role: "user",
 * //     content: "What are safety requirements?",
 * //     timestamp: "2024-01-15T10:30:00Z",
 * //   },
 * //   {
 * //     id: "msg-124",
 * //     role: "assistant",
 * //     content: "Safety requirements include...",
 * //     timestamp: "2024-01-15T10:30:05Z",
 * //     references: [{ name: "safety-manual.pdf", url: "...", relevance: "85%" }]
 * //   }
 * // ]
 * ```
 */
export async function loadMessageHistory(sessionId: string): Promise<ChatMessage[]> {
  try {
    const supabase = await createAdminSupabaseClient();

    // Fetch messages for the session
    const { data: messages, error } = await supabase
      .from('sbwc_chat_messages')
      .select('id, role, content, created_at, metadata')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading message history:', error);
      return [];
    }

    if (!messages || messages.length === 0) {
      return [];
    }

    // Transform database format to frontend format
    return messages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.created_at,
      references: msg.metadata?.references || undefined,
    }));
  } catch (error) {
    console.error('Unexpected error loading message history:', error);
    return [];
  }
}

/**
 * Saves a message to the database
 *
 * Persists user or assistant messages to sbwc_chat_messages table.
 * Stores references array in metadata JSONB field for assistant messages.
 * Updates the session's updated_at timestamp to reflect recent activity.
 *
 * @param sessionId - The chat session ID
 * @param role - Message role ('user' or 'assistant')
 * @param content - Message content text
 * @param references - Optional array of document references for assistant messages
 * @returns Promise resolving to success boolean
 *
 * @example
 * ```typescript
 * // Save user message
 * await saveMessage(sessionId, 'user', 'What are safety requirements?');
 *
 * // Save assistant message with references
 * await saveMessage(
 *   sessionId,
 *   'assistant',
 *   'Safety requirements include...',
 *   [{ name: 'safety-manual.pdf', url: '...', relevance: '85%' }]
 * );
 * ```
 */
export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  references?: Reference[]
): Promise<boolean> {
  try {
    const supabase = await createAdminSupabaseClient();

    // Save message to database
    const { error: messageError } = await supabase.from('sbwc_chat_messages').insert({
      session_id: sessionId,
      role,
      content,
      tokens_used: null, // Can be populated later if tracking token usage
      model: role === 'assistant' ? 'gpt-4o' : null,
      created_at: new Date().toISOString(),
      metadata: references ? { references } : {},
    });

    if (messageError) {
      console.error('Error saving message:', messageError);
      return false;
    }

    // Update session's updated_at timestamp
    const { error: sessionError } = await supabase
      .from('sbwc_chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (sessionError) {
      console.error('Error updating session timestamp:', sessionError);
      // Don't fail the operation if session update fails
    }

    return true;
  } catch (error) {
    console.error('Unexpected error saving message:', error);
    return false;
  }
}

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
