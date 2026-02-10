

## Backup and Restore System for Administration

### Overview
Add a full backup and restore system under the Administration > System tab. This includes database tables, storage bucket, two edge functions, a UI component, and an automatic cleanup mechanism. The system supports both manual and automatic backups (every 2 days), stores backups in Supabase Storage (max 30), and allows module-wise backup/restore.

---

### Technical Architecture

**Database Tables:**

1. `backups` - Stores backup metadata
   - `id` (uuid, PK)
   - `file_name` (text)
   - `file_path` (text) - path in storage bucket
   - `size_bytes` (bigint)
   - `tables_count` (integer)
   - `records_count` (integer)
   - `backup_type` (text) - 'manual' | 'scheduled' | 'module'
   - `module_name` (text, nullable) - for module-specific backups
   - `status` (text) - 'completed' | 'failed' | 'in_progress'
   - `manifest` (jsonb) - table names, row counts, metadata
   - `created_at` (timestamptz)
   - `created_by` (uuid, FK to auth.users)

2. `backup_schedules` - Stores auto-backup configuration
   - `id` (uuid, PK)
   - `frequency` (text) - 'every_2_days' | 'daily' | 'weekly'
   - `time_of_day` (text) - e.g., '00:00'
   - `is_enabled` (boolean)
   - `next_run_at` (timestamptz)
   - `last_run_at` (timestamptz)
   - `created_by` (uuid)
   - `created_at` / `updated_at` (timestamptz)

**Storage:**
- Create a private `backups` bucket with RLS policies allowing only admin users to read/write

**Edge Functions:**

1. `create-backup` - Creates a JSON backup of all (or specific module) tables, uploads to storage, records metadata, enforces 30-backup limit by deleting oldest
2. `restore-backup` - Downloads backup from storage, restores data to specified tables

**Cron Job:**
- Use `pg_cron` + `pg_net` to call `create-backup` every 2 days automatically

---

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/create-backup/index.ts` | Edge function: exports data as JSON, uploads to storage, cleans up old backups (>30) |
| `supabase/functions/restore-backup/index.ts` | Edge function: downloads backup JSON from storage, upserts data into tables |
| `src/components/settings/BackupRestoreSettings.tsx` | Full UI component (adapted from reference file) |
| Migration | Creates `backups`, `backup_schedules` tables, `backups` storage bucket, RLS policies |

### Files to Modify

| File | Change |
|------|--------|
| `src/components/settings/AdminSettingsPage.tsx` | Replace "System" placeholder with `BackupRestoreSettings` component, add `Database` icon import, add 'backup' tab mapping |

---

### Feature Details

#### Manual Backup
- "Export All Data" button creates a full backup of all CRM tables (leads, contacts, accounts, deals, action_items, etc.)
- Backup is saved as JSON to the `backups` storage bucket
- Metadata recorded in `backups` table

#### Automatic Backup (every 2 days)
- Toggle to enable/disable scheduled backups
- Configurable time of day
- Uses `pg_cron` to invoke the `create-backup` edge function every 2 days
- Schedule info shows next run and last run times

#### Restore
- Select any backup from history
- Confirmation dialog requiring user to type "CONFIRM"
- Warns about data overwrite
- Calls `restore-backup` edge function

#### Module-wise Backup and Restore
- Individual backup/restore per module (Leads, Contacts, Accounts, Deals, Meetings, Tasks)
- Each module card shows record count and allows import/export
- Template download for CSV imports
- Adapted from the reference `ModuleImportExport` component

#### 30-Backup Limit
- After creating a new backup, the `create-backup` edge function checks total count
- If >30, deletes the oldest backups (both storage file and metadata record)

#### Backup History
- Shows last 30 backups with:
  - File name, date/time, type (Manual/Scheduled/Module)
  - Tables count, records count, file size
  - Download, Restore, Delete actions

---

### Suggested Improvements You May Have Missed

1. **Pre-restore automatic backup** - Before any restore, automatically create a safety backup so users can revert if the restore goes wrong
2. **Backup integrity verification** - Add checksum/hash validation to ensure backups are not corrupted before restore
3. **Selective table restore** - Allow users to choose which tables to restore from a backup instead of all-or-nothing
4. **Backup size monitoring** - Show total storage used by backups and warn when approaching storage limits
5. **Backup notifications** - Send notification to admin when auto-backup completes or fails
6. **Export as downloadable file** - Allow downloading backup JSON to local machine as an additional safeguard

---

### Implementation Sequence

1. Create migration for `backups` and `backup_schedules` tables + storage bucket + RLS
2. Create `create-backup` edge function
3. Create `restore-backup` edge function
4. Create `BackupRestoreSettings.tsx` UI component
5. Update `AdminSettingsPage.tsx` to wire in the new component under "System" tab
6. Set up `pg_cron` job for auto-backup every 2 days
7. Deploy edge functions and test end-to-end

