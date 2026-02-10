
# Fix Raw JSON Display in History Details

## Problem
When viewing History Details for CREATE entries, nested data (like `record_data`) is displayed as raw JSON strings instead of a user-friendly format. This happens because:
1. The `parseFieldChanges` fallback treats every key (including nested objects) as a "field change" and stringifies objects
2. The well-formatted `renderFormattedDetails` function never runs because `parseFieldChanges` always produces results

## Solution

### File: `src/components/DealExpandedPanel.tsx`

**Change 1 - Fix `formatValue` (line 67)**
When `formatValue` encounters an object value, instead of `JSON.stringify`, format it as a readable key-value string or return a placeholder. This prevents raw JSON from appearing anywhere in the field changes table.

**Change 2 - Fix `parseFieldChanges` fallback (lines 114-121)**
In the final fallback section, skip keys whose values are objects (like `record_data`, `old_data`, `updated_fields`). This ensures that nested record data is not shoved into the field changes table as JSON. Only scalar values (strings, numbers, booleans) will appear as field change rows.

**Change 3 - Ensure `renderFormattedDetails` handles `record_data` (line 488)**
Update `renderFormattedDetails` to also extract and display `record_data` from the details object. Currently it only checks for `old_data` and `updated_fields` but CREATE entries often store the record in a `record_data` key. The record snapshot section will then render each field as a human-readable key-value pair using the existing `formatDetailValue` helper (which already handles dates, currencies, percentages, and UUIDs).

**Change 4 - Fix condition for showing `renderFormattedDetails` (lines 1042-1051)**
Adjust the condition so `renderFormattedDetails` is shown when the field changes table only has scalar metadata rows (module, status, operation, timestamp) but no actual data changes. Alternatively, always call `renderFormattedDetails` when there is a `record_data` key present, regardless of whether `parseFieldChanges` returned results.

## Result
- CREATE entries will show a clean summary (Module, Status, Operation badges) plus a "Record Snapshot" with all fields rendered as readable labels and values
- No raw JSON will appear anywhere in the History Details dialog
- UPDATE entries with `field_changes` will continue to show the Old/New value table as before
- Dates will be formatted, numbers will be localized, UUIDs will be truncated, and nulls will show "--"
