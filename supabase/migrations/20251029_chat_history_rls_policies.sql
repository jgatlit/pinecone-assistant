-- Row Level Security Policies for Chat History Feature
-- Phase 1: Backend Implementation
-- Date: 2025-10-29

-- Enable RLS on tables
ALTER TABLE sbwc_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sbwc_chat_messages ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- CHAT SESSIONS POLICIES
-- =============================================================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
ON sbwc_chat_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own sessions
CREATE POLICY "Users can create own sessions"
ON sbwc_chat_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions (for updating title, updated_at, metadata)
CREATE POLICY "Users can update own sessions"
ON sbwc_chat_sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own sessions (optional - implement if needed)
CREATE POLICY "Users can delete own sessions"
ON sbwc_chat_sessions FOR DELETE
USING (auth.uid() = user_id);

-- =============================================================================
-- CHAT MESSAGES POLICIES
-- =============================================================================

-- Users can view messages from their own sessions
CREATE POLICY "Users can view own messages"
ON sbwc_chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sbwc_chat_sessions
    WHERE sbwc_chat_sessions.id = sbwc_chat_messages.session_id
    AND sbwc_chat_sessions.user_id = auth.uid()
  )
);

-- Users can create messages in their own sessions
CREATE POLICY "Users can create messages in own sessions"
ON sbwc_chat_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sbwc_chat_sessions
    WHERE sbwc_chat_sessions.id = sbwc_chat_messages.session_id
    AND sbwc_chat_sessions.user_id = auth.uid()
  )
);

-- Users can update messages in their own sessions (optional - for editing)
CREATE POLICY "Users can update messages in own sessions"
ON sbwc_chat_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM sbwc_chat_sessions
    WHERE sbwc_chat_sessions.id = sbwc_chat_messages.session_id
    AND sbwc_chat_sessions.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sbwc_chat_sessions
    WHERE sbwc_chat_sessions.id = sbwc_chat_messages.session_id
    AND sbwc_chat_sessions.user_id = auth.uid()
  )
);

-- Users can delete messages in their own sessions (optional)
CREATE POLICY "Users can delete messages in own sessions"
ON sbwc_chat_messages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM sbwc_chat_sessions
    WHERE sbwc_chat_sessions.id = sbwc_chat_messages.session_id
    AND sbwc_chat_sessions.user_id = auth.uid()
  )
);

-- =============================================================================
-- INDEXES for Performance
-- =============================================================================

-- Index on session user_id for faster session lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
ON sbwc_chat_sessions(user_id);

-- Index on session updated_at for ordering recent sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at
ON sbwc_chat_sessions(updated_at DESC);

-- Index on messages session_id for faster message history queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
ON sbwc_chat_messages(session_id);

-- Index on messages created_at for ordering messages chronologically
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
ON sbwc_chat_messages(created_at);

-- Composite index for efficient session-based message queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
ON sbwc_chat_messages(session_id, created_at);

-- =============================================================================
-- COMMENTS for Documentation
-- =============================================================================

COMMENT ON TABLE sbwc_chat_sessions IS
'Stores chat sessions for authenticated users. Each user can have multiple sessions. RLS enforces user isolation.';

COMMENT ON TABLE sbwc_chat_messages IS
'Stores individual chat messages within sessions. Messages can be from user or assistant role. References stored in metadata JSONB field.';

COMMENT ON COLUMN sbwc_chat_messages.metadata IS
'JSONB field storing message metadata including references array for assistant messages: { references: [{ name, url, relevance }] }';

COMMENT ON COLUMN sbwc_chat_sessions.metadata IS
'JSONB field for extensible session metadata. Can store custom fields as needed.';
