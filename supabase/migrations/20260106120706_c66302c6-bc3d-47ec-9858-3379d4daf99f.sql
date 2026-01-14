-- Add column to track contact-to-lead conversions to prevent duplicates
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS converted_from_contact_id UUID REFERENCES public.contacts(id);

-- Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_leads_converted_from_contact ON public.leads(converted_from_contact_id);

-- Add unique constraint to prevent same contact being converted multiple times
ALTER TABLE public.leads ADD CONSTRAINT leads_converted_from_contact_unique UNIQUE (converted_from_contact_id);