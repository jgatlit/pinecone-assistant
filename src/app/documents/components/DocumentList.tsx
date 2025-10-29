'use client';

/**
 * Document list component
 * Displays all user documents with search and sort functionality
 */

import { useEffect, useState } from 'react';
import DocumentCard from './DocumentCard';

interface Document {
  id: string;
  name: string;
  storage_path: string;
  file_size_bytes: number;
  created_at: string;
  updated_at: string;
}

type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/documents');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch documents');
      }

      setDocuments(data.documents || []);
      setFilteredDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Filter and sort documents
  useEffect(() => {
    let filtered = [...documents];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) => doc.name.toLowerCase().includes(query));
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'size-desc':
          return b.file_size_bytes - a.file_size_bytes;
        case 'size-asc':
          return a.file_size_bytes - b.file_size_bytes;
        default:
          return 0;
      }
    });

    setFilteredDocuments(filtered);
  }, [documents, searchQuery, sortBy]);

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Your Documents</h2>
        <button
          onClick={fetchDocuments}
          disabled={loading}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <svg
            className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Search and sort controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="size-desc">Largest first</option>
          <option value="size-asc">Smallest first</option>
        </select>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4" />
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-12">
          <svg
            className="w-12 h-12 text-red-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDocuments}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredDocuments.length === 0 && !searchQuery && (
        <div className="text-center py-12">
          <svg
            className="w-12 h-12 text-muted-foreground mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm text-muted-foreground mb-2">No documents yet</p>
          <p className="text-xs text-muted-foreground">
            Upload your first document to get started
          </p>
        </div>
      )}

      {/* No search results */}
      {!loading && !error && filteredDocuments.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <svg
            className="w-12 h-12 text-muted-foreground mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-sm text-muted-foreground mb-2">No documents found</p>
          <p className="text-xs text-muted-foreground">
            Try a different search term
          </p>
        </div>
      )}

      {/* Document list */}
      {!loading && !error && filteredDocuments.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Showing {filteredDocuments.length} of {documents.length} document
            {documents.length !== 1 ? 's' : ''}
          </p>
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              id={doc.id}
              name={doc.name}
              file_size_bytes={doc.file_size_bytes}
              created_at={doc.created_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}
