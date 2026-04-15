

# MART Strategy — Complete UI/UX Overhaul & Missing Features

## Problems Identified

### Layout & Space Issues
1. **Message section uses full width but content is sparse** — Email templates, call scripts, LinkedIn messages, and materials are stacked vertically in single-column cards with action buttons pushed to the far right, creating vast empty space in between
2. **Each MART section is a separate Card** — Creates excessive vertical spacing with redundant borders
3. **Audience section is single-column** — Job titles, departments, seniority, industries, company sizes are stacked vertically, wasting horizontal space
4. **Region section** — Region cards use `grid-cols-2` which is fine, but the add/edit form is also single-column when it could be more compact
5. **Timing section** — Start/end dates use large `text-lg` font and occupy excessive vertical space for simple read-only info
6. **LinkedIn message body overflows** — Long text shown in `line-clamp-2` but the progress bar stretches full width creating visual noise

### Missing Features
1. **No sort/reorder for email templates** — Users cannot prioritize template order (Initial → Follow-up → Final sequence)
2. **No preview mode for email templates** — Users must open edit modal to read full content
3. **No "Copy to Clipboard" for email templates** — Only LinkedIn messages have copy; emails and scripts don't
4. **No audience segment filter on Message cards** — Cannot quickly see templates by segment
5. **No indication of which segment each content targets in the collapsed header summary**
6. **Materials section has no drag-and-drop or reorder** — Minor, acceptable
7. **No "Expand/Preview" for call scripts** — Must open edit modal to review talking points and objections
8. **Audience section has no "clear all" button**
9. **Timing section cannot edit dates inline** — Only shows a warning to use "Edit" button, which opens the full campaign modal

### Logic Issues
1. **LinkedIn duplicate function is missing** — `duplicateEmailTemplate` exists but LinkedIn cards show `confirmDeleteEmailTemplate` for delete, yet no duplicate button exists (Copy button copies text to clipboard, not duplicate the record)
2. **No validation feedback when saving empty audience** — Save button is disabled but no explanation shown
3. **Content counts in MART progress header don't include materials count in the summary text** — `getContentSummary` for "message" includes materials but the collapsed header `·` summary only shows when there's content

---

## Implementation Plan

### 1. Compact MART Strategy Layout (CampaignMARTStrategy.tsx)
- Reduce `space-y-4` to `space-y-3` between section cards
- Make progress card more compact: combine progress bar + section pills into a single tighter row
- Remove redundant `CardHeader` padding — use `py-2` instead of `py-3`

### 2. Redesign Message Section Layout (CampaignMARTMessage.tsx) — Major
- **Use a 2-column grid** for email templates and call scripts when there are 2+ items: `grid grid-cols-1 lg:grid-cols-2 gap-3`
- **Add "Copy" button to email template cards** (copy subject + body to clipboard)
- **Add expand/collapse for call script details** — Show talking points, questions, objections inline on click without opening modal
- **Truncate LinkedIn message body** to 2 lines with proper `line-clamp-2` and remove full-width progress bar (show char count as badge instead)
- **Add "Duplicate" button to LinkedIn template cards** (currently missing, only Copy exists)
- **Compact the section headers** — Reduce spacing between Email/Script/LinkedIn/Materials sections from `space-y-6` to `space-y-4`
- **Materials table** — Make more compact, reduce padding

### 3. Redesign Audience Section (CampaignMARTAudience.tsx)
- **Use 2-column grid layout**: Left column = Job Titles + Industries (tag inputs), Right column = Departments + Seniority + Company Sizes (checkboxes)
- **Add "Clear All" button** next to Save
- **Make summary banner more prominent** — Move it above the Save button as a colored callout
- Reduce `space-y-5` to `space-y-3`

### 4. Redesign Timing Section (CampaignMARTTiming.tsx)
- **Compact layout**: Put start date, end date, days remaining, and progress bar in a single horizontal row using `grid grid-cols-4`
- Reduce date font from `text-lg` to `text-sm font-medium`
- Move timing note to the right of the date/progress section in a 2-column layout
- Keep warning banner for missing dates

### 5. Region Section Minor Tweaks (CampaignMARTRegion.tsx)
- Already uses 2-column grid — no major changes needed
- Make the add/edit form inline more compact (reduce padding)

---

## Files to Edit

| File | Changes |
|------|---------|
| `src/components/campaigns/CampaignMARTStrategy.tsx` | Compact spacing, tighter progress card |
| `src/components/campaigns/CampaignMARTMessage.tsx` | 2-column grid for templates/scripts, add copy button to emails, add duplicate to LinkedIn, expand/collapse for scripts, compact char count display |
| `src/components/campaigns/CampaignMARTAudience.tsx` | 2-column grid layout, clear all button |
| `src/components/campaigns/CampaignMARTTiming.tsx` | Horizontal compact layout for dates/progress, 2-column with timing note |

