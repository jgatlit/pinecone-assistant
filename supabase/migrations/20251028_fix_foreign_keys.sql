-- Fix foreign key constraints for demo mode
-- Makes created_by nullable to allow document uploads without authentication

ALTER TABLE sbwc_documents 
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE sbwc_chat_sessions 
  ALTER COLUMN user_id DROP NOT NULL;
