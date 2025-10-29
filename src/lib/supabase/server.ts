/**
 * Server-side Supabase client for API routes and server actions
 * Handles cookie-based authentication with Next.js
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

/**
 * Creates a Supabase client for server-side operations
 *
 * This client:
 * - Runs on the server (API routes, server components, server actions)
 * - Uses the anon key with user auth via cookies
 * - Respects Row Level Security (RLS) policies
 * - Handles cookie get/set/remove operations for auth state
 *
 * @returns Promise resolving to Supabase server client instance
 * @throws Error if required environment variables are missing
 */
export async function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // Handle cases where cookies can't be set (e.g., middleware)
          // This is expected in some Next.js contexts
        }
      },
    },
  });
}

/**
 * Creates a Supabase admin client with service role privileges
 *
 * WARNING: This client bypasses Row Level Security (RLS) policies.
 * Only use for:
 * - Admin operations that need to bypass RLS
 * - System-level operations (e.g., RPC calls)
 * - Background jobs
 *
 * Never expose this client to the browser or use with untrusted input.
 *
 * @returns Promise resolving to Supabase admin client instance
 * @throws Error if required environment variables are missing
 */
export async function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // Handle cases where cookies can't be set
        }
      },
    },
  });
}
