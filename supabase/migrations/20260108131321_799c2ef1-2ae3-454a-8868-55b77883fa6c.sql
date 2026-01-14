-- 1. Fix Profiles RLS - Allow all authenticated users to read profiles for display names
DROP POLICY IF EXISTS "Users can view their own profile or admins can view all" ON public.profiles;

CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. Update Leads RLS to include contact_owner check for update/delete
DROP POLICY IF EXISTS "Users can update their own leads, admins can update all" ON public.leads;
CREATE POLICY "Users can update their own leads, admins can update all"
ON public.leads
FOR UPDATE
TO authenticated
USING (is_user_admin() OR created_by = auth.uid() OR contact_owner = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own leads, admins can delete all" ON public.leads;
CREATE POLICY "Users can delete their own leads, admins can delete all"
ON public.leads
FOR DELETE
TO authenticated
USING (is_user_admin() OR created_by = auth.uid() OR contact_owner = auth.uid());

-- 3. Update Contacts RLS to include contact_owner check
DROP POLICY IF EXISTS "Users can update their own contacts, admins can update all" ON public.contacts;
CREATE POLICY "Users can update their own contacts, admins can update all"
ON public.contacts
FOR UPDATE
TO authenticated
USING (is_user_admin() OR created_by = auth.uid() OR contact_owner = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own contacts, admins can delete all" ON public.contacts;
CREATE POLICY "Users can delete their own contacts, admins can delete all"
ON public.contacts
FOR DELETE
TO authenticated
USING (is_user_admin() OR created_by = auth.uid() OR contact_owner = auth.uid());

-- 4. Update Accounts RLS to include account_owner check
DROP POLICY IF EXISTS "Users can update their own accounts, admins can update all" ON public.accounts;
CREATE POLICY "Users can update their own accounts, admins can update all"
ON public.accounts
FOR UPDATE
TO authenticated
USING (is_user_admin() OR created_by = auth.uid() OR account_owner = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own accounts, admins can delete all" ON public.accounts;
CREATE POLICY "Users can delete their own accounts, admins can delete all"
ON public.accounts
FOR DELETE
TO authenticated
USING (is_user_admin() OR created_by = auth.uid() OR account_owner = auth.uid());