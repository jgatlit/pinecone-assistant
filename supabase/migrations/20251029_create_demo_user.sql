-- Create demo/system user for unauthenticated chat sessions
-- This allows the app to work without authentication until Phase 2
-- Date: 2025-10-29

-- Insert demo user into auth.users table if it doesn't exist
-- Note: This requires superuser/service role access
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'demo@system.local',
  '',  -- No password for system user
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "system", "providers": ["system"]}'::jsonb,
  '{"name": "Demo User", "is_system": true}'::jsonb,
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Add comment explaining the demo user
COMMENT ON TABLE auth.users IS 'Auth users table. Includes system demo user (00000000-0000-0000-0000-000000000000) for unauthenticated sessions.';
