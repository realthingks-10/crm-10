-- Add reply tracking fields to email_history table
ALTER TABLE email_history ADD COLUMN IF NOT EXISTS message_id TEXT;
ALTER TABLE email_history ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;
ALTER TABLE email_history ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE email_history ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE email_history ADD COLUMN IF NOT EXISTS thread_id TEXT;

-- Create email_replies table for storing reply details
CREATE TABLE IF NOT EXISTS email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_history_id UUID NOT NULL REFERENCES email_history(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body_preview TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  graph_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_history_message_id ON email_history(message_id);
CREATE INDEX IF NOT EXISTS idx_email_history_thread_id ON email_history(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_email_history_id ON email_replies(email_history_id);

-- Enable RLS on email_replies
ALTER TABLE email_replies ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_replies
CREATE POLICY "Authenticated users can view all email replies"
ON email_replies FOR SELECT
USING (true);

CREATE POLICY "Users can insert email replies"
ON email_replies FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update email replies"
ON email_replies FOR UPDATE
USING (true);

CREATE POLICY "Admins can delete email replies"
ON email_replies FOR DELETE
USING (is_user_admin());