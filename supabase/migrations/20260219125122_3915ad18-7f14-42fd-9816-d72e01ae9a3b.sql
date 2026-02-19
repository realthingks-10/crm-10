
-- Add backup_scope and backup_module columns to backup_schedules
ALTER TABLE public.backup_schedules 
  ADD COLUMN IF NOT EXISTS backup_scope text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS backup_module text;
