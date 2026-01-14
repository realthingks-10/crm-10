-- Add threading columns to email_history table
ALTER TABLE email_history ADD COLUMN IF NOT EXISTS parent_email_id UUID REFERENCES email_history(id);
ALTER TABLE email_history ADD COLUMN IF NOT EXISTS is_reply BOOLEAN DEFAULT false;

-- Create index for faster thread queries
CREATE INDEX IF NOT EXISTS idx_email_history_thread_id ON email_history(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_history_parent_email_id ON email_history(parent_email_id);