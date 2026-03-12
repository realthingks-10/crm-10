

## Audit Logging Gap Analysis — Full CRM App

After deep-diving into every module's CRUD operations, here are all the missing audit log entries and improvements needed.

---

### CRITICAL GAPS (No Audit Logging At All)

| # | Location | Operation | Impact |
|---|----------|-----------|--------|
| 1 | `DealExpandedPanel.tsx` — `handleDeleteActionItem` (line 1017) | Action item DELETE | **This is the bug you reported** — Deepak's deletions are invisible |
| 2 | `DealExpandedPanel.tsx` — `handleAddActionItem` (line 786) | Action item CREATE from deal panel | New action items created inline are not logged |
| 3 | `DealExpandedPanel.tsx` — `handleStatusChange` (line 976) | Action item status UPDATE (Open/In Progress) | Only logs Completed/Cancelled, misses other status changes |
| 4 | `DealExpandedPanel.tsx` — `handleAssignedToChange` (line 1004) | Action item REASSIGNMENT | Assignment changes are silent |
| 5 | `DealExpandedPanel.tsx` — `handleDueDateChange` (line 1012) | Action item DUE DATE change | Date changes are silent |
| 6 | `DealExpandedPanel.tsx` — `StakeholdersSection.handleAddContact` (line 417) | Stakeholder ADD | Adding budget owner/champion/etc not logged |
| 7 | `DealExpandedPanel.tsx` — `StakeholdersSection.handleRemoveContact` (line 428) | Stakeholder REMOVE | Removing stakeholders not logged |
| 8 | `AccountTable.tsx` — `handleBulkDelete` (line 196) | Accounts BULK DELETE | Deletes multiple accounts with zero audit trail |
| 9 | `ContactTable.tsx` — `handleConvertToLead` (line 196) | Contact → Lead conversion | Creates a lead but neither the conversion nor the lead creation is logged |
| 10 | `LeadTable.tsx` — `handleConvertSuccess` (line 307) | Lead status → "Converted" | Status update to 'Converted' is not logged |
| 11 | `useActionItems.tsx` — `bulkDeleteMutation` (line 345) | Action items BULK DELETE | No audit logging in the hook |
| 12 | `useActionItems.tsx` — `bulkUpdateStatusMutation` | Action items BULK STATUS UPDATE | No audit logging in the hook |
| 13 | `InlineEditCell.tsx` / List view inline edits | Deal field inline edits | The `onSave` callback goes to `handleUpdateDeal` in DealsPage which IS logged — but only if called through that path. Need to verify all paths. |

---

### IMPROVEMENTS NEEDED

| # | Issue | Detail |
|---|-------|--------|
| A | **DealExpandedPanel uses raw `security_audit_log` insert** instead of `useCRUDAudit` | Lines 983-994 manually insert into the audit table with inconsistent format (action: "update" lowercase vs standard "UPDATE") |
| B | **Deals single delete uses `logBulkDelete`** | Even single deal deletes go through `handleDeleteDeals` which calls `logBulkDelete` — should use `logDelete` for single deletes with full deal data |
| C | **Account bulk delete has no logging** | `AccountTable.handleBulkDelete` has no `logBulkDelete` call |
| D | **DealExpandedPanel action item CREATE doesn't use `logCreate`** | Should use `useCRUDAudit` consistently |
| E | **Stakeholder changes are completely unaudited** | All add/remove stakeholder operations in the deal panel are invisible |
| F | **Contact → Lead conversion is unaudited** | `ContactTable.handleConvertToLead` creates a lead with no audit trail |

---

### Implementation Plan

**File: `src/components/DealExpandedPanel.tsx`**
1. Import and initialize `useCRUDAudit` hook
2. `handleDeleteActionItem`: Capture item data before delete, call `logDelete('action_items', id, itemData)`
3. `handleAddActionItem`: After successful insert, call `logCreate('action_items', ...)` with the inserted data
4. `handleStatusChange`: Use `logUpdate` for ALL status changes (not just Completed/Cancelled), replace raw `security_audit_log` insert with `useCRUDAudit`
5. `handleAssignedToChange`: Add `logUpdate('action_items', id, { assigned_to: userId }, { assigned_to: oldValue })`
6. `handleDueDateChange`: Add `logUpdate('action_items', id, { due_date: date }, { due_date: oldValue })`
7. `StakeholdersSection`: Import `useCRUDAudit`, log `handleAddContact` as CREATE on `deal_stakeholders`, log `handleRemoveContact` as DELETE on `deal_stakeholders`

**File: `src/components/AccountTable.tsx`**
8. Add `logBulkDelete('accounts', selectedAccounts.length, selectedAccounts)` to `handleBulkDelete`

**File: `src/components/ContactTable.tsx`**
9. Add `logCreate('leads', ..., leadData)` to `handleConvertToLead` after successful insert

**File: `src/components/LeadTable.tsx`**
10. Add `logUpdate('leads', leadToConvert.id, { lead_status: 'Converted' }, { lead_status: leadToConvert.lead_status })` to `handleConvertSuccess`

**File: `src/hooks/useActionItems.tsx`**
11. This hook doesn't use `useCRUDAudit` — but the callers in `ActionItems.tsx` do log after calling the mutations. This is acceptable as-is since logging happens at the page level.

**File: `src/pages/DealsPage.tsx`**
12. In `handleDeleteDeals` for single deletes (dealIds.length === 1), use `logDelete` with the full deal data instead of `logBulkDelete`

---

### Summary

**13 missing audit points** across 5 files. The biggest blind spots are:
- All inline action item operations in the Deal Expanded Panel (create, delete, reassign, date change)
- All stakeholder add/remove operations  
- Account bulk deletes
- Contact-to-Lead conversions
- Lead status changes on conversion

