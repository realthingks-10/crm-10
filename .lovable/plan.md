

# Complete Backup & Restore Deep Fix

## Current State (Verified from Live Database)

| Metric | Value |
|--------|-------|
| `security_audit_log` total rows | **26,167** |
| Noise rows (SESSION_START/END/ACTIVE/INACTIVE + others) | **25,233** (96.4%) |
| Meaningful rows (CREATE, UPDATE, DELETE, etc.) | **934** |
| Full backup record count (latest) | 5,232 (correct, post-fix) |
| Old bloated backup still in history | 30,777 records (contains `security_audit_log`: 25,551, `user_sessions`: 1, `keep_alive`: 1) |
| pg_cron extension | Enabled |
| pg_net extension | Enabled |
| Existing cron jobs | **None** (scheduled backups not wired up) |
| Backup schedule configured | Yes - full, every 2 days, 06:00, enabled, next_run: Feb 21 |

---

## Issue 1 -- Clean up 25,233 noise rows (SQL via insert tool)

Run a DELETE to remove all session noise, page navigation, window focus/blur, heartbeat, SELECT, and SENSITIVE_DATA_ACCESS rows. These actions have zero operational value and are already hidden from the Audit Log UI.

```sql
DELETE FROM security_audit_log 
WHERE action IN (
  'SESSION_START', 'SESSION_END', 
  'SESSION_ACTIVE', 'SESSION_INACTIVE', 
  'SESSION_HEARTBEAT', 
  'WINDOW_BLUR', 'WINDOW_FOCUS', 
  'USER_ACTIVITY', 
  'SELECT', 'SENSITIVE_DATA_ACCESS', 
  'PAGE_NAVIGATION'
);
```

Expected result: ~934 meaningful rows remain (CREATE, UPDATE, DELETE, BULK_DELETE, DATA_IMPORT, DATA_EXPORT, NOTE, EMAIL, CALL, MEETING, PASSWORD_CHANGE, SESSION_TERMINATED).

**IMPORTANT**: This is a DELETE of noise data only. No production business data is touched.

---

## Issue 2 -- Remove SENSITIVE_DATA_ACCESS logging from useSecureDataAccess

**File:** `src/hooks/useSecureDataAccess.tsx`

The `logDataAccess` call on line 18 with `'SELECT'` is now safely skipped (the hook has a guard). BUT lines 32-37 still log `SENSITIVE_DATA_ACCESS` on every successful fetch of deals/contacts/leads. This fires ~2 rows per page navigation to those modules. Since these are excluded from the Audit Log UI already, they serve no purpose.

**Fix:** Remove lines 17-18 (`await logDataAccess(tableName, operation)`) and lines 32-37 (the `SENSITIVE_DATA_ACCESS` logging block). Keep the `DATA_ACCESS_FAILED` log (lines 23-28) since failed access IS meaningful.

---

## Issue 3 -- Restore function still imports noise tables from old backups (CRITICAL)

**File:** `supabase/functions/restore-backup/index.ts`

The restore function correctly removed `security_audit_log`, `user_sessions`, `keep_alive` from `DELETE_ORDER` and `INSERT_ORDER`. However, lines 203-215 contain a **catch-all loop** that restores ANY table present in the backup file that is NOT in `INSERT_ORDER`:

```typescript
// Also restore any tables in the backup that aren't in INSERT_ORDER
for (const table of tablesToRestore) {
  if (INSERT_ORDER.includes(table) || !backupData[table]?.length) continue
  // ... upserts the data
}
```

This means if someone restores the old 30,777-record backup (which contains `security_audit_log` with 25,551 rows, `user_sessions`, and `keep_alive`), those tables WILL be restored through this catch-all, defeating the entire fix.

**Fix:** Add a `SKIP_TABLES` blocklist and filter them out in both the catch-all loop AND the pre-restore safety backup:

```typescript
const SKIP_TABLES = ['security_audit_log', 'user_sessions', 'keep_alive']
```

Then filter `tablesToRestore` at line 123 to exclude these tables, so they are never deleted, backed up, or restored.

---

## Issue 4 -- Set up pg_cron job for scheduled backups (SQL via insert tool)

Both `pg_cron` and `pg_net` extensions are confirmed enabled. The scheduled-backup edge function is deployed. A schedule exists (full backup, every 2 days at 06:00, enabled). But NO cron job exists to trigger it.

```sql
SELECT cron.schedule(
  'scheduled-backup-check',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://nreslricievaamrwfrlx.supabase.co/functions/v1/scheduled-backup',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZXNscmljaWV2YWFtcndmcmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0Mjc3NTUsImV4cCI6MjA3MTAwMzc1NX0.xHf2lE2OGZ5jNGOBWGAsOdoyHqdwi_TxWkbKiAr1RJY"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

This checks every hour if any scheduled backup is due (`next_run_at <= now()`). Since the function uses `verify_jwt = false` and validates schedules server-side, the anon key is sufficient.

---

## Issue 5 -- Test the backup flow (via edge function curl)

After applying the fixes, test by invoking the `create-backup` function to confirm:
- Full backup record count is ~5,232 (not 31,000+)
- Deals module backup includes leads + lead_action_items
- The scheduled-backup function responds correctly when invoked

---

## Summary of All Changes

| # | Type | What | Risk |
|---|------|------|------|
| 1 | SQL (insert tool) | DELETE 25,233 noise rows from `security_audit_log` | Zero risk -- only deletes session/navigation noise, no business data |
| 2 | Code edit | Remove `logDataAccess` and `SENSITIVE_DATA_ACCESS` from `useSecureDataAccess.tsx` | Stops future noise generation |
| 3 | Code edit + deploy | Add `SKIP_TABLES` blocklist to `restore-backup/index.ts` catch-all | Prevents old bloated backups from re-importing noise |
| 4 | SQL (insert tool) | Create pg_cron job for scheduled-backup | Activates scheduled backups |
| 5 | Test | Invoke create-backup and scheduled-backup via curl | Validates everything works |

## What Will NOT Be Done (per user instruction)

- No data restore operations
- No modification of production business data
- No deletion of backup history records

