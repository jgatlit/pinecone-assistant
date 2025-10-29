/**
 * Document processing and storage utilities
 * Handles file upload, text extraction, chunking, and embedding generation
 */

import { createAdminSupabaseClient } from './supabase/server';
import { generateEmbeddingsBatch, estimateTokenCount } from './embedding';
import type { ProcessedDocument, DocumentChunk } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Maximum chunk size in tokens
 * Keeps chunks small enough for good retrieval granularity
 */
const MAX_CHUNK_TOKENS = 512;

/**
 * Minimum chunk size in tokens
 * Prevents tiny chunks that lack context
 */
const MIN_CHUNK_TOKENS = 50;

/**
 * Chunk overlap in tokens
 * Ensures context continuity between chunks
 */
const CHUNK_OVERLAP_TOKENS = 50;

/**
 * Processes and stores a document with embeddings
 *
 * Full pipeline for text files:
 * 1. Extract text from file
 * 2. Chunk text into sections
 * 3. Generate embeddings for each chunk
 * 4. Store document metadata
 * 5. Store document sections with embeddings
 *
 * For PDF files:
 * 1. Upload to storage
 * 2. Create document record with "pending" status
 * 3. Background worker will process later
 *
 * @param file - File object (from FormData)
 * @param userId - User ID from authentication
 * @returns Promise resolving to processed document info
 * @throws Error if processing fails at any stage
 *
 * @example
 * ```typescript
 * const formData = await request.formData();
 * const file = formData.get('file') as File;
 * const result = await processDocument(file, user.id);
 * ```
 */
export async function processDocument(
  file: File,
  userId: string
): Promise<ProcessedDocument> {
  try {
    const supabase = await createAdminSupabaseClient();
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    // Generate document ID and storage path
    const documentId = uuidv4();
    const storagePath = `documents/${userId}/${documentId}/${file.name}`;

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('sbwc-documents')
      .upload(storagePath, file);

    if (uploadError) {
      throw new Error(`File upload failed: ${uploadError.message}`);
    }

    // For PDFs: Create pending record, let worker process later
    if (isPDF) {
      // Build document data - omit created_by if using demo user (no auth)
      const documentData: any = {
        id: documentId,
        name: file.name,
        storage_path: storagePath,
        file_size_bytes: file.size,
        metadata: { processing_status: 'pending', file_type: 'pdf' },
      };

      // Only include created_by if not using demo user ID
      if (userId !== '00000000-0000-0000-0000-000000000001') {
        documentData.created_by = userId;
      }

      const { data: document, error: docError } = await supabase
        .from('sbwc_documents')
        .insert(documentData)
        .select()
        .single();

      if (docError) {
        await supabase.storage.from('sbwc-documents').remove([storagePath]);
        throw new Error(`Document insert failed: ${docError.message}`);
      }

      return {
        id: documentId,
        name: file.name,
        storage_path: storagePath,
        sections_count: 0,
        uploaded_at: (document as any).created_at,
        processing_status: 'pending',
      };
    }

    // For text files: Process immediately
    const text = await extractText(file);

    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in file');
    }

    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error('Failed to create text chunks');
    }

    const embeddings = await generateEmbeddingsBatch(chunks.map((c) => c.content));

    // Insert document record - omit created_by if using demo user
    const documentData: any = {
      id: documentId,
      name: file.name,
      storage_path: storagePath,
      file_size_bytes: file.size,
      metadata: { processing_status: 'completed', file_type: 'text' },
    };

    // Only include created_by if not using demo user ID
    if (userId !== '00000000-0000-0000-0000-000000000001') {
      documentData.created_by = userId;
    }

    const { data: document, error: docError } = await supabase
      .from('sbwc_documents')
      .insert(documentData)
      .select()
      .single();

    if (docError) {
      await supabase.storage.from('sbwc-documents').remove([storagePath]);
      throw new Error(`Document insert failed: ${docError.message}`);
    }

    // Insert document sections with embeddings
    const sections = chunks.map((chunk, index) => ({
      document_id: documentId,
      content: chunk.content,
      heading: chunk.heading,
      embedding: embeddings[index],
      token_count: chunk.tokenCount,
    }));

    const { error: sectionsError } = await supabase
      .from('sbwc_document_sections')
      .insert(sections as any);

    if (sectionsError) {
      await supabase.from('sbwc_documents').delete().eq('id', documentId);
      await supabase.storage.from('sbwc-documents').remove([storagePath]);
      throw new Error(`Sections insert failed: ${sectionsError.message}`);
    }

    return {
      id: documentId,
      name: file.name,
      storage_path: storagePath,
      sections_count: chunks.length,
      uploaded_at: (document as any).created_at,
      processing_status: 'completed',
    };
  } catch (error) {
    console.error('Error processing document:', error);
    throw new Error(
      `Document processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extracts text content from a file
 *
 * Currently supports:
 * - Plain text files (.txt)
 * - PDF files (.pdf)
 *
 * @param file - File to extract text from
 * @returns Promise resolving to extracted text
 * @throws Error if file type is unsupported or extraction fails
 */
async function extractText(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  // Plain text
  if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    return await file.text();
  }

  // PDFs will be handled by background worker
  // This function is only called for text files now
  throw new Error(`Unsupported file type for inline processing: ${fileType || 'unknown'}. Only .txt files can be processed immediately.`);
}

/**
 * Chunks text into sections with overlapping context
 *
 * Strategy:
 * - Split by paragraphs (double newlines)
 * - Group paragraphs into chunks under MAX_CHUNK_TOKENS
 * - Add overlap between chunks for context continuity
 * - Extract headings (lines starting with #)
 *
 * @param text - Text to chunk
 * @returns Array of document chunks with metadata
 */
function chunkText(text: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  // Split into paragraphs
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  let currentChunk: string[] = [];
  let currentTokenCount = 0;
  let currentHeading: string | null = null;

  for (const paragraph of paragraphs) {
    // Check if paragraph is a heading (starts with #)
    if (paragraph.startsWith('#')) {
      currentHeading = paragraph.replace(/^#+\s*/, '').trim();
    }

    const paragraphTokens = estimateTokenCount(paragraph);

    // If adding this paragraph exceeds max, save current chunk and start new one
    if (
      currentTokenCount + paragraphTokens > MAX_CHUNK_TOKENS &&
      currentChunk.length > 0
    ) {
      const content = currentChunk.join('\n\n');
      const tokenCount = estimateTokenCount(content);

      if (tokenCount >= MIN_CHUNK_TOKENS) {
        chunks.push({
          content,
          heading: currentHeading,
          tokenCount,
        });
      }

      // Start new chunk with overlap (keep last paragraph for context)
      const overlapParagraph = currentChunk[currentChunk.length - 1];
      currentChunk = [overlapParagraph, paragraph];
      currentTokenCount = estimateTokenCount(overlapParagraph) + paragraphTokens;
    } else {
      currentChunk.push(paragraph);
      currentTokenCount += paragraphTokens;
    }
  }

  // Add final chunk if it meets minimum size
  if (currentChunk.length > 0) {
    const content = currentChunk.join('\n\n');
    const tokenCount = estimateTokenCount(content);

    if (tokenCount >= MIN_CHUNK_TOKENS) {
      chunks.push({
        content,
        heading: currentHeading,
        tokenCount,
      });
    }
  }

  return chunks;
}

/**
 * Deletes a document and all associated data
 *
 * Cascade deletes:
 * - Document sections (via database cascade)
 * - File from storage bucket
 *
 * @param documentId - Document ID to delete
 * @param userId - User ID (for verification via RLS)
 * @returns Promise resolving when deletion is complete
 * @throws Error if deletion fails
 */
export async function deleteDocument(
  documentId: string,
  userId: string
): Promise<void> {
  try {
    const supabase = await createAdminSupabaseClient();

    // Get document to find storage path
    const { data: document, error: fetchError } = await supabase
      .from('sbwc_documents')
      .select('storage_path, created_by')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      throw new Error('Document not found');
    }

    // Verify user owns document (skip check if created_by is null or demo user)
    const doc = document as any;
    if (doc.created_by && doc.created_by !== userId && userId !== '00000000-0000-0000-0000-000000000001') {
      throw new Error('Unauthorized: You do not own this document');
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('sbwc-documents')
      .remove([doc.storage_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete document record (cascade will delete sections)
    const { error: deleteError } = await supabase
      .from('sbwc_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      throw new Error(`Document deletion failed: ${deleteError.message}`);
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error(
      `Failed to delete document: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
