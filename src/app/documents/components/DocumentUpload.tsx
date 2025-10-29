'use client';

/**
 * Document upload component
 * Supports both file upload (drag & drop) and URL input
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchDocumentFromURL, validateDocumentURL } from '@/lib/url-fetcher';

type UploadMethod = 'file' | 'url';

interface UploadProgress {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  message: string;
  progress: number;
}

export default function DocumentUpload() {
  const router = useRouter();
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('file');
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    status: 'idle',
    message: '',
    progress: 0,
  });

  // Handle file upload
  const uploadFile = useCallback(async (file: File) => {
    try {
      setProgress({
        status: 'uploading',
        message: 'Uploading file...',
        progress: 30,
      });

      // Validate file type
      const allowedTypes = ['text/plain', 'application/pdf'];
      const allowedExtensions = ['.txt', '.pdf'];
      const hasValidType = allowedTypes.includes(file.type);
      const hasValidExtension = allowedExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (!hasValidType && !hasValidExtension) {
        throw new Error('Invalid file type. Only .txt and .pdf files are supported.');
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File too large. Maximum size is 10MB.');
      }

      // Validate file is not empty
      if (file.size === 0) {
        throw new Error('File is empty.');
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload to API
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      setProgress({
        status: 'processing',
        message: 'Processing document...',
        progress: 70,
      });

      // Wait a bit to show processing state
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setProgress({
        status: 'success',
        message: 'Document uploaded successfully!',
        progress: 100,
      });

      // Refresh the document list
      router.refresh();

      // Reset after 2 seconds
      setTimeout(() => {
        setProgress({ status: 'idle', message: '', progress: 0 });
      }, 2000);
    } catch (error) {
      setProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Upload failed',
        progress: 0,
      });

      // Reset error after 5 seconds
      setTimeout(() => {
        setProgress({ status: 'idle', message: '', progress: 0 });
      }, 5000);
    }
  }, [router]);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  // Handle drag events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  // Handle URL upload
  const handleUrlUpload = async () => {
    try {
      // Validate URL
      const validation = validateDocumentURL(urlInput);
      if (!validation.valid) {
        setProgress({
          status: 'error',
          message: validation.error || 'Invalid URL',
          progress: 0,
        });
        setTimeout(() => {
          setProgress({ status: 'idle', message: '', progress: 0 });
        }, 5000);
        return;
      }

      setProgress({
        status: 'uploading',
        message: 'Fetching document from URL...',
        progress: 20,
      });

      // Fetch document from URL
      const { file } = await fetchDocumentFromURL(urlInput);

      setProgress({
        status: 'uploading',
        message: 'Uploading document...',
        progress: 50,
      });

      // Process as normal file upload
      await uploadFile(file);

      // Clear URL input on success
      setUrlInput('');
    } catch (error) {
      setProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch document from URL',
        progress: 0,
      });

      setTimeout(() => {
        setProgress({ status: 'idle', message: '', progress: 0 });
      }, 5000);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setUploadMethod('file')}
          className={`px-4 py-2 font-medium transition-colors ${
            uploadMethod === 'file'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          File Upload
        </button>
        <button
          onClick={() => setUploadMethod('url')}
          className={`px-4 py-2 font-medium transition-colors ${
            uploadMethod === 'url'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          URL Input
        </button>
      </div>

      {/* File Upload Tab */}
      {uploadMethod === 'file' && (
        <div>
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            } ${progress.status === 'uploading' || progress.status === 'processing' ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex flex-col items-center gap-4">
              <svg
                className="w-12 h-12 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <div>
                <p className="text-lg font-medium mb-1">
                  Drag files here or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supported: .txt, .pdf (max 10MB)
                </p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".txt,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={progress.status === 'uploading' || progress.status === 'processing'}
                />
                <span className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                  Browse Files
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* URL Upload Tab */}
      {uploadMethod === 'url' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="url-input" className="block text-sm font-medium mb-2">
              Enter document URL
            </label>
            <input
              id="url-input"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/document.pdf"
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              disabled={progress.status === 'uploading' || progress.status === 'processing'}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must be a direct link to a .txt or .pdf file
            </p>
          </div>
          <button
            onClick={handleUrlUpload}
            disabled={!urlInput.trim() || progress.status === 'uploading' || progress.status === 'processing'}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Fetch Document
          </button>
        </div>
      )}

      {/* Progress indicator */}
      {progress.status !== 'idle' && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-2">
            {progress.status === 'uploading' || progress.status === 'processing' ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            ) : progress.status === 'success' ? (
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span
              className={`text-sm font-medium ${
                progress.status === 'success'
                  ? 'text-green-600'
                  : progress.status === 'error'
                  ? 'text-red-600'
                  : 'text-foreground'
              }`}
            >
              {progress.message}
            </span>
          </div>
          {(progress.status === 'uploading' || progress.status === 'processing') && (
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
