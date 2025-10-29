/**
 * URL document fetching utilities
 * Handles fetching documents from URLs and converting to File objects
 */

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Request timeout in milliseconds (30 seconds)
 */
const REQUEST_TIMEOUT = 30000;

/**
 * Result from fetching a document from URL
 */
export interface URLFetchResult {
  file: File;
  name: string;
  size: number;
  type: string;
}

/**
 * Fetches a document from a URL and converts it to a File object
 *
 * Process:
 * 1. Validate URL format
 * 2. Fetch document with timeout
 * 3. Validate content type and size
 * 4. Extract filename from URL or Content-Disposition header
 * 5. Convert response to File object
 *
 * @param url - URL to fetch document from
 * @returns Promise resolving to File object and metadata
 * @throws Error if URL is invalid, fetch fails, or file is too large
 *
 * @example
 * ```typescript
 * const result = await fetchDocumentFromURL('https://example.com/document.pdf');
 * await processDocument(result.file, userId);
 * ```
 */
export async function fetchDocumentFromURL(url: string): Promise<URLFetchResult> {
  // Validate URL
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch (error) {
    throw new Error('Invalid URL format. Please provide a valid URL.');
  }

  // Ensure protocol is http or https
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    throw new Error('URL must use http:// or https:// protocol.');
  }

  // Fetch document with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SBWC-ChatBot/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch document: ${response.status} ${response.statusText}`
      );
    }

    // Get content type
    const contentType =
      response.headers.get('content-type') || 'application/octet-stream';

    // Validate content type (must be .txt or .pdf)
    const isTextFile = contentType.includes('text/plain');
    const isPdfFile = contentType.includes('application/pdf');
    const urlEndsWithTxt = urlObj.pathname.toLowerCase().endsWith('.txt');
    const urlEndsWithPdf = urlObj.pathname.toLowerCase().endsWith('.pdf');

    if (!isTextFile && !isPdfFile && !urlEndsWithTxt && !urlEndsWithPdf) {
      throw new Error(
        'URL must point to a .txt or .pdf file. Detected content type: ' + contentType
      );
    }

    // Get content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      throw new Error(
        `Document from URL exceeds 10MB limit (${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB)`
      );
    }

    // Get filename from URL or Content-Disposition header
    let filename = urlObj.pathname.split('/').pop() || 'document';

    // Try to extract filename from Content-Disposition header
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
      );
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Ensure filename has correct extension
    if (!filename.endsWith('.txt') && !filename.endsWith('.pdf')) {
      if (isPdfFile || urlEndsWithPdf) {
        filename += '.pdf';
      } else {
        filename += '.txt';
      }
    }

    // Convert to blob
    const blob = await response.blob();

    // Check actual file size
    if (blob.size > MAX_FILE_SIZE) {
      throw new Error(
        `Document from URL exceeds 10MB limit (${Math.round(blob.size / 1024 / 1024)}MB)`
      );
    }

    // Determine final content type
    let finalContentType = contentType;
    if (filename.endsWith('.pdf')) {
      finalContentType = 'application/pdf';
    } else if (filename.endsWith('.txt')) {
      finalContentType = 'text/plain';
    }

    // Create File object
    const file = new File([blob], filename, { type: finalContentType });

    return {
      file,
      name: filename,
      size: blob.size,
      type: finalContentType,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'Request timeout. The URL took too long to respond (>30 seconds).'
      );
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new Error(
        'Network error. Unable to reach the URL. Please check the URL and try again.'
      );
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Validates if a URL is likely to point to a supported document
 *
 * Performs basic checks without fetching:
 * - Valid URL format
 * - Supported protocol (http/https)
 * - Likely file extension (.txt or .pdf)
 *
 * @param url - URL to validate
 * @returns Object with validation result and error message if invalid
 *
 * @example
 * ```typescript
 * const result = validateDocumentURL('https://example.com/doc.pdf');
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateDocumentURL(url: string): {
  valid: boolean;
  error?: string;
} {
  // Check if URL is empty
  if (!url || url.trim().length === 0) {
    return { valid: false, error: 'URL cannot be empty.' };
  }

  // Validate URL format
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch (error) {
    return { valid: false, error: 'Invalid URL format.' };
  }

  // Check protocol
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    return { valid: false, error: 'URL must use http:// or https:// protocol.' };
  }

  // Check if URL path suggests a supported file type
  const pathname = urlObj.pathname.toLowerCase();
  if (!pathname.endsWith('.txt') && !pathname.endsWith('.pdf')) {
    return {
      valid: false,
      error:
        'URL should point to a .txt or .pdf file. If the URL is correct, you can still try fetching it.',
    };
  }

  return { valid: true };
}
