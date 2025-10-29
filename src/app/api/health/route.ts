import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      openaiKey: !!process.env.OPENAI_API_KEY,
    },
    database: {
      connected: false,
      sessionsTable: false,
      messagesTable: false,
      error: null as string | null,
    },
  };

  try {
    const supabase = await createAdminSupabaseClient();

    // Test connection with a simple query
    const { data: sessions, error: sessionsError } = await supabase
      .from('sbwc_chat_sessions')
      .select('id')
      .limit(1);

    if (sessionsError) {
      checks.database.error = sessionsError.message;
    } else {
      checks.database.connected = true;
      checks.database.sessionsTable = true;
    }

    // Check messages table
    const { error: messagesError } = await supabase
      .from('sbwc_chat_messages')
      .select('id')
      .limit(1);

    if (!messagesError) {
      checks.database.messagesTable = true;
    }

  } catch (error) {
    checks.database.error = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(checks, { 
    status: checks.database.connected ? 200 : 500 
  });
}
