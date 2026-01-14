-- Clean up duplicate sessions caused by JWT substring collision
-- Keep only the most recent session per user and mark duplicates as inactive

-- First, mark all sessions with JWT-based tokens (starting with 'eyJ') as inactive
-- These are the old buggy tokens that all started with the same JWT header
UPDATE user_sessions
SET is_active = false
WHERE session_token LIKE 'eyJ%'
  AND is_active = true;

-- For any remaining duplicates per user, keep only the most recently active one
WITH ranked_sessions AS (
  SELECT id,
         user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY last_active_at DESC) as rn
  FROM user_sessions
  WHERE is_active = true
)
UPDATE user_sessions
SET is_active = false
WHERE id IN (
  SELECT id FROM ranked_sessions WHERE rn > 1
);