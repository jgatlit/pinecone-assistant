/**
 * Documents management page
 * Main interface for uploading and managing documents
 *
 * TODO: Add authentication when Supabase Auth is fully configured
 */

import DocumentUpload from './components/DocumentUpload';
import DocumentList from './components/DocumentList';
import Link from 'next/link';

export default async function DocumentsPage() {
  return (
    <div className="space-y-8">
      {/* Header with back link */}
      <div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Chat
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-2">Document Library</h1>
        <p className="text-muted-foreground mt-2">
          Upload and manage documents for your SBWC assistant
        </p>
      </div>

      {/* Upload section */}
      <DocumentUpload />

      {/* Document list */}
      <DocumentList />
    </div>
  );
}
