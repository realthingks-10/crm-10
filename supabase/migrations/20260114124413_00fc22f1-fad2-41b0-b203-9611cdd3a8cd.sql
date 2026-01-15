-- Add conversation_id column to email_history for Microsoft Graph threading
ALTER TABLE public.email_history 
ADD COLUMN IF NOT EXISTS conversation_id text;

-- Add index for faster lookups by conversation_id
CREATE INDEX IF NOT EXISTS idx_email_history_conversation_id 
ON public.email_history(conversation_id) 
WHERE conversation_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.email_history.conversation_id IS 'Microsoft Graph conversationId for email threading';