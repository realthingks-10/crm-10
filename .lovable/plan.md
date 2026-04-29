## Fix: Campaign Module — Standardize "Action Item" Terminology

### Root Cause
The CRM's canonical name for this entity is **"Action Item"** (sidebar nav, `/action-items` page, `action_items` table, `CampaignActionItems` tab, `UpcomingActionItems` widget). However, **`CampaignCommunications.tsx`** — the Outlook-style 2-pane view used in the Communications tab — was built using the word **"Task"** throughout its UI strings, modal titles, and toast messages. This produces the inconsistency visible in the screenshot (a "Task" button on a thread card, while the same record shows up under the "Action Items" tab).

The records themselves are stored in `action_items` and surface correctly under the Action Items tab — only the labels in `CampaignCommunications.tsx` are wrong.

A small secondary inconsistency exists in `CampaignSequenceRunsDrawer.tsx`: the audit-log filter dropdown labels the `action_item_created` event as just **"Action item"** (lowercase 'i') instead of **"Action Item"**.

### Scope of Changes (UI strings only — no data, no logic)

**1. `src/components/campaigns/CampaignCommunications.tsx`** — replace all "Task" wording with "Action Item":

| Line | Current | Change to |
|---|---|---|
| 130 | toast `"Task created"` | `"Action item created"` |
| 149 | toast `"Task deleted"` | `"Action item deleted"` |
| 173 | toast `"Task updated"` | `"Action item updated"` |
| 744 | toast `"Task title is required"` | `"Action item title is required"` |
| 767 | toast `"Task created"` | `"Action item created"` |
| 1443 | thread-card button label `Task` (the one in the screenshot) | `Action Item` |
| 1685 | selected-thread header button `Task` | `Action Item` |
| 2719 | modal title `Create Follow-up Task` | `Create Follow-up Action Item` |
| 2744 | input placeholder `Task title...` | `Action item title...` |
| 2770 | modal submit button `Create Task` | `Create Action Item` |
| 2716 | comment `{/* Create Task Modal */}` | `{/* Create Action Item Modal */}` |

State variable names (`taskModalOpen`, `taskForm`, `taskContactId`, `handleCreateTask`, `openTaskForContact`) are **internal** and will be left unchanged to keep the diff minimal and avoid touching unrelated logic — only user-visible strings change.

**2. `src/components/campaigns/CampaignSequenceRunsDrawer.tsx`** (line 23):
- `label: "Action item"` → `label: "Action Item"` (capitalize for consistency with the rest of the UI).

**3. `src/components/campaigns/overview/UpcomingActionItems.tsx`** (line 68):
- Empty-state text `"No upcoming action items"` is fine as a sentence — leave as-is. (Sentence-case body copy is acceptable; we only standardize labels/buttons/titles.)

### Other Naming Audited and Found Consistent
Reviewed the rest of the campaign module for similar duplicate terminology and found no further mismatches worth changing in this pass:
- "Audience / Recipient / Contact" — used appropriately in distinct contexts (Audience = the configured target list, Recipient = a specific row in a send, Contact = the underlying CRM entity).
- "Sequence / Cadence / Follow-up" — only "Sequence" and "Follow-up" are user-facing; both are used correctly (Sequence = the configured multi-step template, Follow-up = an individual delayed send).
- "Email / Message" — "Message" is used only as the tab/strategy label that wraps email content (consistent with existing `CampaignMessage` component name).

### Files Modified
- `src/components/campaigns/CampaignCommunications.tsx`
- `src/components/campaigns/CampaignSequenceRunsDrawer.tsx`

No DB migrations, no logic changes, no other components affected.
