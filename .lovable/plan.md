

## Comprehensive Fix: Backup/Restore, Import/Export, and UI Improvements

### Issues Found

**1. CSV Export Shows Raw UUIDs (Critical UX Issue)**
All module exporters (Contacts, Accounts, Leads, Deals) output raw UUIDs for user-reference fields (`contact_owner`, `created_by`, `modified_by`, `lead_owner`, `account_owner`, `assigned_to`). The reference files use a `UserNameUtils` class that resolves UUIDs to display names, but this utility was never created in the actual codebase.

**2. Leads Exporter Also Shows Raw UUIDs**
The `LeadsCSVExporter` has its own custom logic that bypasses `GenericCSVExporter` and outputs UUIDs directly without any name resolution.

**3. Scheduled Backups Don't Actually Run**
The `backup_schedules` table stores preferences (enabled, frequency, time), but there is no `pg_cron` job configured to actually trigger the `create-backup` edge function. The schedule toggle saves to the database but nothing executes. The `next_run_at` is always null.

**4. Backup "Import" Button is Disabled/Non-functional**
The "Import Backup File" button on the UI is permanently disabled with text saying "Use the restore option from backup history below." This is confusing -- if there's no file upload capability, the entire Import card is misleading.

**5. Supabase Default 1000-Row Limit in Backups**
The `create-backup` edge function uses `adminClient.from(table).select('*')` without pagination. Tables with more than 1000 rows (e.g., contacts with 4,402 records) will silently truncate data in backups.

**6. Restore Deletes Everything Then Inserts**
The restore function deletes all data first, then inserts. If the insert fails partway through, data is lost. There's no pre-restore safety backup.

**7. Missing `contacts_module` in Backup Tables**
The `BACKUP_TABLES` list in `create-backup` references `contacts` but the actual table name used elsewhere might differ. Need to verify consistency.

**8. UI Layout Issues**
- The backup history items are too wide and busy with redundant info
- Module backup cards could be more compact (currently 3-column grid with large padding)
- Import card takes up half the screen but is non-functional
- No visual feedback showing backup is complete (the file_name in history is a long timestamp string)

---

### Implementation Plan

#### Step 1: Create `UserNameUtils` Utility Class
Create `src/utils/userNameUtils.ts` with methods to:
- `extractUserIds(data, fields?)` -- collect all unique UUIDs from user-reference fields
- `fetchUserDisplayNames(userIds)` -- call the existing `fetch-user-display-names` edge function to resolve UUIDs to names
- `isUserField(field)` -- check if field is a user-reference field (`contact_owner`, `created_by`, `modified_by`, `lead_owner`, `account_owner`, `assigned_to`)
- `isDateTimeField(field)` -- check if field is a datetime field
- `formatIdForExport(id)` -- shorten UUID for export (first 8 chars)
- `formatDateTimeForExport(value)` -- human-readable datetime format
- `resolveUserId(name, userIdMap, fallback)` -- resolve display name back to UUID for import

#### Step 2: Update `GenericCSVExporter` to Resolve UUIDs
Modify `src/hooks/import-export/genericCSVExporter.ts`:
- Before building CSV rows, call `UserNameUtils.extractUserIds()` and `UserNameUtils.fetchUserDisplayNames()`
- For each user-reference field, replace UUID with display name
- For ID field, use shortened format
- For datetime fields, use human-readable format

#### Step 3: Update `LeadsCSVExporter` to Resolve UUIDs
Modify `src/hooks/import-export/leadsCSVExporter.ts`:
- Add the same UUID-to-name resolution logic
- Replace raw UUIDs with display names in the output

#### Step 4: Fix Backup Data Truncation (1000-Row Limit)
Modify `supabase/functions/create-backup/index.ts`:
- Add pagination logic to fetch ALL records from each table (loop with `.range()` in batches of 1000)
- This ensures tables with >1000 rows (like contacts with 4,402) are fully backed up

#### Step 5: Add Pre-Restore Safety Backup
Modify `supabase/functions/restore-backup/index.ts`:
- Before deleting/restoring, create an automatic "pre-restore" safety backup
- This allows recovery if the restore goes wrong

#### Step 6: Fix Scheduled Backup (Actually Make It Work)
- Update `BackupRestoreSettings.tsx` to compute and save `next_run_at` when enabling the schedule
- Add a note in the UI explaining that `pg_cron` needs to be set up (or set it up if extensions are available)
- Update `handleSaveSchedule` to calculate `next_run_at` based on frequency and time_of_day

#### Step 7: Redesign the UI for Compactness

**Export/Import Section:**
- Merge into a single compact card with Export button and a note about restoring from history (remove the misleading disabled Import card)

**Scheduled Backup Section:**
- Keep as-is but show computed `next_run_at` properly

**Module Backup Section:**
- Make cards smaller and more compact (reduce padding, use inline layout)
- Show record count inline with the module name

**Backup History Section:**
- Make each row more compact -- single line with key info
- Use a proper table layout instead of stacked cards
- Shorten file names to human-readable format (e.g., "Full Backup" or "Leads Backup" instead of `backup-full-2026-02-10T13-28-45-859Z.json`)
- Add a delete confirmation that doesn't need a separate dialog

---

### Technical Summary

| File | Change |
|------|--------|
| `src/utils/userNameUtils.ts` | **New** -- UUID-to-name resolution utility |
| `src/hooks/import-export/genericCSVExporter.ts` | Resolve UUIDs to display names, format IDs and datetimes |
| `src/hooks/import-export/leadsCSVExporter.ts` | Resolve UUIDs to display names |
| `supabase/functions/create-backup/index.ts` | Add pagination to handle >1000 rows per table |
| `supabase/functions/restore-backup/index.ts` | Add pre-restore safety backup |
| `src/components/settings/BackupRestoreSettings.tsx` | UI redesign: compact layout, proper schedule handling, cleaner history |

### Expected Results
- CSV exports show human-readable names instead of UUIDs
- Backups capture ALL records (not just first 1000)
- Restore has safety net (pre-restore backup)
- Schedule shows proper next run time
- UI is cleaner and more compact

