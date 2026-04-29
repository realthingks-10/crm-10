I found the remaining inconsistent labels. The visible “Task” text is still coming mainly from the Campaign Action Items tab shown in your screenshot, plus a few campaign timing labels and one broken navigation alias.

Plan to fix all of this:

1. Standardize Campaign Action Items UI
   - In `CampaignActionItems.tsx`, replace all user-facing “Task/tasks” text with “Action Item/action items”.
   - This includes:
     - `Add Task` → `Add Action Item`
     - `Save Task` → `Save Action Item`
     - `Task title...` → `Action item title...`
     - `Task created/deleted/updated` → `Action item created/deleted/updated`
     - `No tasks yet...` → `No action items yet...`
     - `Create your first task` → `Create your first action item`
     - `Delete Task` / `Edit Task` → `Delete Action Item` / `Edit Action Item`
   - Also update visible comments only where they can cause future confusion.

2. Standardize campaign sequence/timing labels
   - In `CampaignTiming.tsx`, replace non-email follow-up labels:
     - `LinkedIn task` → `LinkedIn step`
     - `Call task` → `Call step`
     - rendered step labels like `Call task` / `LinkedIn task` → `Call step` / `LinkedIn step`
   - This keeps “task” reserved nowhere in Campaign UI and aligns with sequence terminology.

3. Fix Action Items → Campaign navigation alias
   - In `ActionItemsTable.tsx`, change the campaign link from `?tab=tasks` to the correct `?tab=actionItems`.
   - In `CampaignDetail.tsx`, add URL tab handling so links like `?tab=actionItems` open the Action Items tab reliably.
   - Optionally support legacy `?tab=tasks` by redirecting/mapping it to `actionItems` so old links do not break.

4. Keep internal variable names only where safe
   - Internal identifiers like `task_reminders`, `taskModalOpen`, `handleCreateTask`, or database/internal event names can remain if they are not displayed to users.
   - I will change user-facing labels, placeholders, tooltips, toasts, and route query values, but avoid unnecessary refactors that could break existing saved preferences or database fields.

5. Remove LinkedIn Follow-up from AI generation and keep only 3 message-section outputs
   - In `AIGenerateWizard.tsx`, remove `linkedin-followup` from the visible AI generation options and the default channel-kind mapping.
   - The Generate with AI modal will only offer the three message section types:
     - Email
     - LinkedIn Connection / LinkedIn Message
     - Call Script
   - This prevents the fourth “LinkedIn Follow-up” AI card from coming back.
   - Keep existing saved LinkedIn follow-up records readable where needed, so old data does not disappear or crash the UI.

6. Clean related visible wording outside the campaign screen
   - In notification settings, update visible copy like `task alerts` to `action item alerts`.
   - Leave internal preference key `task_reminders` unchanged because it is likely a stored settings field.

7. Verification search
   - After edits, run a targeted search across campaign components and related Action Item files to verify no visible `Task`, `tasks`, `LinkedIn task`, `Call task`, or `?tab=tasks` remains.
   - Remaining lowercase/internal `task` references will be checked and only left if they are non-UI implementation details or database field names.