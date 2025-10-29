/**
 * Browser-safe Supabase client for client-side operations
 * Uses @supabase/ssr for proper cookie handling with Next.js
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/**
 * Creates a Supabase client for browser-side operations
 *
 * This client:
 * - Uses the anon key (safe for browser)
 * - Respects Row Level Security (RLS) policies
 * - Handles auth state automatically via cookies
 *
 * @returns Supabase browser client instance
 * @throws Error if required environment variables are missing
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
