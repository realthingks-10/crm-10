-- Create user_access_cache table for storing daily access snapshots
CREATE TABLE IF NOT EXISTS public.user_access_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_date date NOT NULL DEFAULT CURRENT_DATE,
  role text NOT NULL DEFAULT 'user',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile jsonb DEFAULT '{}'::jsonb,
  role_assigned_at timestamptz,
  permissions_updated_at timestamptz,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cache_date)
);

-- Enable RLS
ALTER TABLE public.user_access_cache ENABLE ROW LEVEL SECURITY;

-- Users can only read their own cache
CREATE POLICY "Users can read own access cache"
  ON public.user_access_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_access_cache_user_date 
  ON public.user_access_cache(user_id, cache_date);

-- Create the RPC function to get/create access snapshot
CREATE OR REPLACE FUNCTION public.get_my_access_snapshot()
RETURNS TABLE(
  role text,
  permissions jsonb,
  profile jsonb,
  computed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_role text;
  v_current_role_assigned_at timestamptz;
  v_current_permissions jsonb;
  v_current_permissions_updated_at timestamptz;
  v_current_profile jsonb;
  v_cached_record user_access_cache%ROWTYPE;
  v_needs_refresh boolean := false;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get current role from user_roles
  SELECT ur.role::text, ur.assigned_at 
  INTO v_current_role, v_current_role_assigned_at
  FROM user_roles ur
  WHERE ur.user_id = v_user_id;
  
  -- Default to 'user' if no role found
  v_current_role := COALESCE(v_current_role, 'user');

  -- Get current permissions as JSON array
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pp.id,
      'page_name', pp.page_name,
      'route', pp.route,
      'admin_access', pp.admin_access,
      'manager_access', pp.manager_access,
      'user_access', pp.user_access
    )
  ), MAX(pp.updated_at)
  INTO v_current_permissions, v_current_permissions_updated_at
  FROM page_permissions pp;
  
  v_current_permissions := COALESCE(v_current_permissions, '[]'::jsonb);

  -- Get current profile
  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'email', p."Email ID",
    'avatar_url', p.avatar_url,
    'phone', p.phone,
    'timezone', p.timezone
  )
  INTO v_current_profile
  FROM profiles p
  WHERE p.id = v_user_id;
  
  v_current_profile := COALESCE(v_current_profile, '{}'::jsonb);

  -- Check if we have a valid cache for today
  SELECT * INTO v_cached_record
  FROM user_access_cache uac
  WHERE uac.user_id = v_user_id 
    AND uac.cache_date = CURRENT_DATE;

  -- Determine if refresh is needed
  IF v_cached_record IS NULL THEN
    v_needs_refresh := true;
  ELSIF v_cached_record.role != v_current_role THEN
    v_needs_refresh := true;
  ELSIF v_current_role_assigned_at IS NOT NULL 
    AND v_cached_record.role_assigned_at IS DISTINCT FROM v_current_role_assigned_at THEN
    v_needs_refresh := true;
  ELSIF v_current_permissions_updated_at IS NOT NULL 
    AND v_cached_record.permissions_updated_at IS DISTINCT FROM v_current_permissions_updated_at THEN
    v_needs_refresh := true;
  END IF;

  -- Upsert cache if needed
  IF v_needs_refresh THEN
    INSERT INTO user_access_cache (
      user_id, cache_date, role, permissions, profile,
      role_assigned_at, permissions_updated_at, computed_at
    ) VALUES (
      v_user_id, CURRENT_DATE, v_current_role, v_current_permissions, v_current_profile,
      v_current_role_assigned_at, v_current_permissions_updated_at, now()
    )
    ON CONFLICT (user_id, cache_date) 
    DO UPDATE SET
      role = EXCLUDED.role,
      permissions = EXCLUDED.permissions,
      profile = EXCLUDED.profile,
      role_assigned_at = EXCLUDED.role_assigned_at,
      permissions_updated_at = EXCLUDED.permissions_updated_at,
      computed_at = now();
    
    -- Return fresh data
    RETURN QUERY SELECT 
      v_current_role,
      v_current_permissions,
      v_current_profile,
      now();
  ELSE
    -- Return cached data
    RETURN QUERY SELECT 
      v_cached_record.role,
      v_cached_record.permissions,
      v_cached_record.profile,
      v_cached_record.computed_at;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_access_snapshot() TO authenticated;