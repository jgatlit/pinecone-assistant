/**
 * Health check endpoint
 * Verifies system status and database connectivity
 */

import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/health
 *
 * Performs health check:
 * - Verifies Supabase connection
 * - Returns system status
 *
 * No authentication required - public endpoint
 *
 * @returns Health status with database connectivity info
 *
 * @example Response (200 OK):
 * ```json
 * {
 *   "status": "healthy",
 *   "timestamp": "2024-01-15T10:30:00.000Z",
 *   "database": "connected",
 *   "version": "1.0.0"
 * }
 * ```
 *
 * @example Response (500 Error):
 * ```json
 * {
 *   "status": "unhealthy",
 *   "timestamp": "2024-01-15T10:30:00.000Z",
 *   "database": "disconnected",
 *   "error": "Connection failed"
 * }
 * ```
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    // Test database connectivity with simple query
    const supabase = await createAdminSupabaseClient();

    const { error } = await supabase
      .from('sbwc_documents')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Health check database error:', error);
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp,
          database: 'disconnected',
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp,
        database: 'connected',
        version: '1.0.0',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Health check error:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp,
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
