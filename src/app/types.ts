export interface File {
    id: string;
    name: string;
    file_size_bytes: number;
    created_at: string;
    updated_at?: string;
    storage_path?: string;
    metadata?: any;
  }
 
  // A 'Reference' is a file that the Assistant has access to and used
  // when answering a user question
  export interface Reference {
    name: string;
    url?: string | undefined;
    documentId?: string;
    relevance?: string;
    error?: string;
  }

  export interface Message {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
    references?: Reference[]; 
  }
