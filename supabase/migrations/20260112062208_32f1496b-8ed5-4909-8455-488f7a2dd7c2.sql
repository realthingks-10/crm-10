-- Sync missing profiles from auth.users
-- This inserts profile records for any users that exist in auth.users but not in profiles

INSERT INTO public.profiles (id, full_name, "Email ID")
SELECT 
  au.id,
  COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(au.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(au.raw_user_meta_data->>'display_name'), ''),
    SPLIT_PART(au.email, '@', 1)
  ) as full_name,
  au.email as "Email ID"
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;