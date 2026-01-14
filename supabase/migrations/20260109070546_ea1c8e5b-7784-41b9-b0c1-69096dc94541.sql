-- Enable realtime for CRM tables
-- This ensures that changes to these tables are broadcast to all subscribers

-- Set REPLICA IDENTITY FULL for complete row data on updates
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.deals REPLICA IDENTITY FULL;
ALTER TABLE public.meetings REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication
-- Using DROP/ADD pattern to avoid errors if already added
DO $$
BEGIN
  -- Remove tables first if they exist (to avoid duplicates)
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.accounts;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.contacts;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.leads;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.deals;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.meetings;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.tasks;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

-- Now add all tables to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;