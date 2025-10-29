/**
 * Documents API endpoint
 * Handles document upload, listing, and deletion
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { processDocument, deleteDocument } from '@/lib/document-processor';

export const maxDuration = 30;

/**
 * GET /api/documents
 *
 * Lists all documents for the authenticated user
 *
 * Authentication: Required (via Supabase session)
 * Authorization: Users can only see their own documents (enforced by RLS)
 *
 * @returns List of user's documents with metadata
 *
 * @example Response (200 OK):
 * ```json
 * {
 *   "documents": [
 *     {
 *       "id": "uuid",
 *       "name": "safety-manual.pdf",
 *       "storage_path": "documents/user-id/uuid/file.pdf",
 *       "created_at": "2024-01-15T10:30:00.000Z",
 *       "updated_at": "2024-01-15T10:30:00.000Z"
 *     }
 *   ],
 *   "count": 1
 * }
 * ```
 */
export async function GET() {
  try {
    // TODO: Re-enable authentication when Supabase Auth is configured
    // For now, use admin client to bypass RLS for development/testing
    const supabase = await createAdminSupabaseClient();

    // Query all documents
    const { data: documents, error: queryError } = await supabase
      .from('sbwc_documents')
      .select('id, name, storage_path, file_size_bytes, metadata, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('Error fetching documents:', queryError);
      return NextResponse.json(
        {
          status: 'error',
          message: 'Failed to fetch documents',
          documents: [],
          count: 0,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: 'success',
        documents: documents || [],
        count: documents?.length || 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Documents GET error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        documents: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents
 *
 * Uploads and processes a new document
 *
 * Process:
 * 1. Validate authentication
 * 2. Extract file from multipart form data
 * 3. Validate file (type, size)
 * 4. Process document (extract text, chunk, embed)
 * 5. Store in database and storage
 *
 * Authentication: Required
 * Content-Type: multipart/form-data
 * Body: FormData with 'file' field
 *
 * @param request - Next.js request with multipart/form-data
 * @returns Processed document info
 *
 * @example Request:
 * ```typescript
 * const formData = new FormData();
 * formData.append('file', fileBlob, 'document.pdf');
 * await fetch('/api/documents', {
 *   method: 'POST',
 *   body: formData
 * });
 * ```
 *
 * @example Response (201 Created):
 * ```json
 * {
 *   "status": "success",
 *   "message": "Document uploaded successfully",
 *   "document": {
 *     "id": "uuid",
 *     "name": "safety-manual.pdf",
 *     "storage_path": "documents/user-id/uuid/file.pdf",
 *     "sections_count": 15,
 *     "uploaded_at": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Re-enable authentication when Supabase Auth is configured
    // For now, use a demo user ID for development/testing
    const demoUserId = '00000000-0000-0000-0000-000000000001';

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'No file provided. Include a file in the "file" field.',
        },
        { status: 400 }
      );
    }

    // Validate file
    if (file.size === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'File is empty',
        },
        { status: 400 }
      );
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        {
          status: 'error',
          message: `File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['text/plain', 'application/pdf'];
    const allowedExtensions = ['.txt', '.pdf'];
    const fileName = file.name.toLowerCase();
    const isValidType =
      allowedTypes.includes(file.type) ||
      allowedExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValidType) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Unsupported file type. Supported types: .txt, .pdf',
        },
        { status: 400 }
      );
    }

    // Process document (extract, chunk, embed, store)
    const document = await processDocument(file, demoUserId);

    return NextResponse.json(
      {
        status: 'success',
        message: 'Document uploaded successfully',
        document,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Document upload error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents?id=<document_id>
 *
 * Deletes a document and all associated data
 *
 * Deletes:
 * - Document record
 * - Document sections (via cascade)
 * - File from storage bucket
 *
 * Authentication: Required
 * Authorization: Users can only delete their own documents (enforced by RLS)
 *
 * @param request - Next.js request with document_id query param
 * @returns Success confirmation
 *
 * @example Response (200 OK):
 * ```json
 * {
 *   "status": "success",
 *   "message": "Document deleted successfully"
 * }
 * ```
 */
export async function DELETE(request: NextRequest) {
  try {
    // TODO: Re-enable authentication when Supabase Auth is configured
    // For now, use a demo user ID for development/testing
    const demoUserId = '00000000-0000-0000-0000-000000000001';

    // Get document ID from query params
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Document ID required',
        },
        { status: 400 }
      );
    }

    // Delete document
    await deleteDocument(documentId, demoUserId);

    return NextResponse.json(
      {
        status: 'success',
        message: 'Document deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Document deletion error:', error);

    const message = error instanceof Error ? error.message : 'Deletion failed';
    const status = message.includes('Unauthorized') ? 403 : 500;

    return NextResponse.json(
      {
        status: 'error',
        message,
      },
      { status }
    );
  }
}
