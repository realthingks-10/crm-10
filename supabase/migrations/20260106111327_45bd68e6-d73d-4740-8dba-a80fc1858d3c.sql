-- Add indexes for commonly filtered/queried columns to improve performance
-- These indexes will significantly speed up page load times

-- Accounts indexes
CREATE INDEX IF NOT EXISTS idx_accounts_account_owner ON public.accounts(account_owner);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON public.accounts(created_at DESC);

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_contact_owner ON public.contacts(contact_owner);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON public.contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_segment ON public.contacts(segment);
CREATE INDEX IF NOT EXISTS idx_contacts_created_time ON public.contacts(created_time DESC);

-- Leads indexes
CREATE INDEX IF NOT EXISTS idx_leads_contact_owner ON public.leads(contact_owner);
CREATE INDEX IF NOT EXISTS idx_leads_account_id ON public.leads(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_status ON public.leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_created_time ON public.leads(created_time DESC);

-- Deals indexes
CREATE INDEX IF NOT EXISTS idx_deals_lead_owner ON public.deals(lead_owner);
CREATE INDEX IF NOT EXISTS idx_deals_account_id ON public.deals(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_modified_at ON public.deals(modified_at DESC);

-- Meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON public.meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON public.meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(status);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- Profiles index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles(full_name);