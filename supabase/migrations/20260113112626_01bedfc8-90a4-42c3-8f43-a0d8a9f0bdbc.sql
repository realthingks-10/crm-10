-- Add last_contacted_at column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP WITH TIME ZONE;

-- Add last_contacted_at column to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP WITH TIME ZONE;