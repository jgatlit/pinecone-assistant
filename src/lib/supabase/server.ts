/**
 * Supabase server-side client utilities
 * Provides admin and authenticated client creation for server components and actions
 */

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client with admin privileges
 * Uses service role key for operations that bypass RLS policies
 *
 * @returns Supabase client with admin privileges
 * @throws Error if environment variables are missing
 *
 * @example
 * ```typescript
 * const supabase = await createAdminSupabaseClient();
 * const { data } = await supabase.from('documents').select('*');
 * ```
 */
export async function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables (URL or SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a Supabase client for the authenticated user
 * Uses anon key with user's auth token from cookies
 * Respects RLS policies based on authenticated user
 *
 * @returns Supabase client with user auth context
 * @throws Error if environment variables are missing
 *
 * @example
 * ```typescript
 * const supabase = await createAuthenticatedSupabaseClient();
 * const { data: { user } } = await supabase.auth.getUser();
 * ```
 */
export async function createAuthenticatedSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (URL or ANON_KEY)');
  }

  const cookieStore = await cookies();
  const authToken = cookieStore.get('sb-access-token')?.value;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    },
  });

  return client;
}
