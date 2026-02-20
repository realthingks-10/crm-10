

## Add Deal Stakeholders Section to Info Details Panel

### Overview
Add a new "Stakeholders" section at the top of the Deal Expanded Panel (Info Details) with four contact dropdown fields: Budget Owner, Champion, Objector, and Influencer. The layout becomes three sections instead of two.

### Database Changes

**Add 4 new columns to the `deals` table** (all nullable UUID columns referencing contacts):
- `budget_owner_contact_id` (uuid, nullable)
- `champion_contact_id` (uuid, nullable)  
- `objector_contact_id` (uuid, nullable)
- `influencer_contact_id` (uuid, nullable)

A new migration file will be created to add these columns.

### UI Changes

**File: `src/components/DealExpandedPanel.tsx`**

Restructure the panel content from 2 sections to 3 sections:

```text
Section 1: Stakeholders (NEW)
  - 2x2 grid of contact dropdowns
  - Budget Owner | Champion
  - Objector     | Influencer
  - Each uses ContactSearchableDropdown
  - Auto-saves on selection (immediate DB update)

Section 2: Updates (existing, moved down)
  - No changes to logic, just position

Section 3: Action Items (existing)
  - No changes
```

- Import `ContactSearchableDropdown` component
- Add state for each stakeholder field, initialized from `deal` props
- Each dropdown change triggers a Supabase update to the deals table and invalidates the deals query
- Reduce the height of Updates and Action Items sections slightly (from `h-[280px]` to `h-[220px]`) to accommodate the new section without overflow
- The stakeholders section uses a compact 2-column grid layout with small labels

### Type Changes

**File: `src/types/deal.ts`**
- Add the 4 new optional fields to the `Deal` interface:
  - `budget_owner_contact_id?: string`
  - `champion_contact_id?: string`
  - `objector_contact_id?: string`
  - `influencer_contact_id?: string`

### Technical Details

| File | Change |
|------|--------|
| `supabase/migrations/[timestamp].sql` | Add 4 UUID columns to deals table |
| `src/types/deal.ts` | Add 4 fields to Deal interface |
| `src/components/DealExpandedPanel.tsx` | Add stakeholders section with ContactSearchableDropdown, reorder sections |
| `src/integrations/supabase/types.ts` | Will auto-update after migration |

### Behavior
- When a contact is selected in any stakeholder dropdown, it immediately saves the contact ID to the deals table
- The "X" clear button removes the association
- Contact names are displayed based on the selected contact's `contact_name`
- All four fields are optional and independent

