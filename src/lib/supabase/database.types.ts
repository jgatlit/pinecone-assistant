/**
 * Database type definitions for Supabase
 * Generate with: npx supabase gen types typescript --project-id <project-id>
 *
 * Placeholder types - replace with actual generated types from your Supabase project
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      SBWC_documents: {
        Row: {
          id: string;
          name: string;
          storage_path: string;
          user_id: string;
          file_size_bytes: number;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          storage_path: string;
          user_id: string;
          file_size_bytes?: number;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          storage_path?: string;
          user_id?: string;
          file_size_bytes?: number;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      SBWC_document_sections: {
        Row: {
          id: number;
          document_id: string;
          content: string;
          heading: string | null;
          embedding: number[];
          token_count: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          document_id: string;
          content: string;
          heading?: string | null;
          embedding: number[];
          token_count: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          document_id?: string;
          content?: string;
          heading?: string | null;
          embedding?: number[];
          token_count?: number;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_sbwc_document_sections: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
          document_ids?: string[] | null;
        };
        Returns: {
          id: number;
          document_id: string;
          content: string;
          heading: string | null;
          similarity: number;
          document_name: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
