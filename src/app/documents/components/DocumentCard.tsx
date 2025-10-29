'use client';

/**
 * Document card component
 * Displays individual document with metadata and actions
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DocumentCardProps {
  id: string;
  name: string;
  file_size_bytes: number;
  created_at: string;
}

export default function DocumentCard({
  id,
  name,
  file_size_bytes,
  created_at,
}: DocumentCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get file icon based on extension
  const getFileIcon = () => {
    const ext = name.toLowerCase().split('.').pop();
    if (ext === 'pdf') {
      return (
        <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          <text x="50%" y="55%" fontSize="6" fill="white" textAnchor="middle" dominantBaseline="middle">PDF</text>
        </svg>
      );
    }
    return (
      <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
        <text x="50%" y="55%" fontSize="6" fill="white" textAnchor="middle" dominantBaseline="middle">TXT</text>
      </svg>
    );
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      const response = await fetch(`/api/documents?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Delete failed');
      }

      // Refresh the document list
      router.refresh();
    } catch (error) {
      console.error('Delete error:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete document');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-4">
          {/* File icon */}
          <div className="flex-shrink-0">{getFileIcon()}</div>

          {/* Document info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate" title={name}>
              {name}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{formatFileSize(file_size_bytes)}</span>
              <span>•</span>
              <span>{formatDate(created_at)}</span>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="flex-shrink-0 p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete document"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Delete Document?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete <strong>{name}</strong>? This action cannot be
              undone and all associated data will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                )}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
