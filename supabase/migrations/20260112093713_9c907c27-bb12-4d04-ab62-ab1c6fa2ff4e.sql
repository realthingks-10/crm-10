-- Create table to queue pending bounce checks after email sends
CREATE TABLE public.pending_bounce_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_history_id UUID REFERENCES public.email_history(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  check_after TIMESTAMPTZ NOT NULL,
  checked BOOLEAN DEFAULT false,
  check_result TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_bounce_checks ENABLE ROW LEVEL SECURITY;

-- Create index for efficient querying of pending checks
CREATE INDEX idx_pending_checks_ready ON public.pending_bounce_checks(check_after, checked) WHERE checked = false;

-- Create index for cleanup of old records
CREATE INDEX idx_pending_checks_created ON public.pending_bounce_checks(created_at);

-- RLS Policy: Allow service role full access (edge functions use service role)
CREATE POLICY "Service role has full access to pending_bounce_checks"
ON public.pending_bounce_checks
FOR ALL
USING (true)
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.pending_bounce_checks IS 'Queue for automated bounce detection checks after emails are sent';