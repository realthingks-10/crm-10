-- Create is_user_manager function
CREATE OR REPLACE FUNCTION public.is_user_manager(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT get_user_role(user_id) = 'manager';
$$;

-- Update contacts UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own contacts, admins can update all" ON public.contacts;
CREATE POLICY "Users can update contacts, managers and admins can update all" 
ON public.contacts 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (created_by = auth.uid()) OR (contact_owner = auth.uid()));

-- Update accounts UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own accounts, admins can update all" ON public.accounts;
CREATE POLICY "Users can update accounts, managers and admins can update all" 
ON public.accounts 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (created_by = auth.uid()) OR (account_owner = auth.uid()));

-- Update leads UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own leads, admins can update all" ON public.leads;
CREATE POLICY "Users can update leads, managers and admins can update all" 
ON public.leads 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (created_by = auth.uid()) OR (contact_owner = auth.uid()));

-- Update meetings UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own meetings, admins can update all" ON public.meetings;
CREATE POLICY "Users can update meetings, managers and admins can update all" 
ON public.meetings 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (created_by = auth.uid()));

-- Update tasks UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own tasks, admins can update all" ON public.tasks;
CREATE POLICY "Users can update tasks, managers and admins can update all" 
ON public.tasks 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (created_by = auth.uid()) OR (assigned_to = auth.uid()));

-- Update contact_activities UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own activities, admins can update all" ON public.contact_activities;
CREATE POLICY "Users can update contact activities, managers and admins can update all" 
ON public.contact_activities 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (created_by = auth.uid()));

-- Update account_activities UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own activities, admins can update all" ON public.account_activities;
CREATE POLICY "Users can update account activities, managers and admins can update all" 
ON public.account_activities 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (created_by = auth.uid()));

-- Update lead_action_items UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own action items, admins can update all" ON public.lead_action_items;
CREATE POLICY "Users can update lead action items, managers and admins can update all" 
ON public.lead_action_items 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (created_by = auth.uid()) OR (assigned_to = auth.uid()));

-- Update deal_action_items UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own action items, admins can update all" ON public.deal_action_items;
CREATE POLICY "Users can update deal action items, managers and admins can update all" 
ON public.deal_action_items 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (created_by = auth.uid()) OR (assigned_to = auth.uid()));

-- Update email_templates UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own templates, admins can update all" ON public.email_templates;
CREATE POLICY "Users can update templates, managers and admins can update all" 
ON public.email_templates 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (created_by = auth.uid()));

-- Update email_history UPDATE policy to include managers
DROP POLICY IF EXISTS "Users can update their own email history, admins can update all" ON public.email_history;
CREATE POLICY "Users can update email history, managers and admins can update all" 
ON public.email_history 
FOR UPDATE 
USING (is_user_admin() OR is_user_manager() OR (sent_by = auth.uid()));

-- NOTE: deals UPDATE policy is NOT changed - managers cannot update deals per requirement