-- Add bounce tracking columns to email_history
ALTER TABLE public.email_history 
ADD COLUMN IF NOT EXISTS bounce_type text,
ADD COLUMN IF NOT EXISTS bounce_reason text,
ADD COLUMN IF NOT EXISTS bounced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS first_open_ip text,
ADD COLUMN IF NOT EXISTS is_valid_open boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS unique_opens integer DEFAULT 0;

-- Add index for bounce tracking queries
CREATE INDEX IF NOT EXISTS idx_email_history_bounce_type ON public.email_history(bounce_type) WHERE bounce_type IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.email_history.bounce_type IS 'Type of bounce: hard, soft, or null if not bounced';
COMMENT ON COLUMN public.email_history.bounce_reason IS 'Detailed bounce error message';
COMMENT ON COLUMN public.email_history.is_valid_open IS 'Whether opens are from real users (not bots/scanners)';
COMMENT ON COLUMN public.email_history.unique_opens IS 'Count of unique opens (deduplicated by IP/session)';