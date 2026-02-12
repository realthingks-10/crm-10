

## Fix Sticky Column Headers Across All Modules

### Root Cause Found

The `Table` UI component (`src/components/ui/table.tsx`, line 9) wraps every table in:
```html
<div class="relative w-full overflow-auto">
```

This creates a **hidden nested scroll container** inside each module. CSS `position: sticky` only works relative to the nearest scrolling ancestor -- so the sticky header sticks to this invisible inner div, not the outer scroll container the user actually sees.

### Why Deals Works

The Deals `ListView` (line 424) has a targeted CSS override:
```
[&>div.relative]:!overflow-visible
```
This forces the Table's inner wrapper from `overflow-auto` to `overflow-visible`, eliminating the nested scroll container. No other module has this fix.

### Solution

Apply the same `[&>div.relative]:!overflow-visible` override to the scroll container in each broken module. This is the minimal, consistent fix.

### Files to Change

#### 1. ContactTable.tsx (line ~185 in the provided code)
The scroll container `<div className="flex-1 min-h-0 overflow-auto">` needs the override added:
```
flex-1 min-h-0 overflow-auto [&>div>div.relative]:!overflow-visible
```
Note: ContactTableBody wraps Table in an extra `<div>`, so the selector needs `>div>div.relative` to reach through.

#### 2. LeadTable.tsx (line 341)
The scroll container `<div className="flex-1 min-h-0 overflow-auto">` needs:
```
flex-1 min-h-0 overflow-auto [&>div.relative]:!overflow-visible
```
LeadTable renders Table directly inside a wrapper div, so selector is `>div.relative` (the Table's wrapper is the first div child's child -- need to verify exact nesting).

#### 3. AccountTable.tsx
The scroll container wrapping `AccountTableBody` needs the same override. Since AccountTable has its own scroll wrapper, apply:
```
flex-1 min-h-0 overflow-auto [&>div>div.relative]:!overflow-visible
```

#### 4. ActionItems.tsx (line 320)
The scroll container `<div className="h-full overflow-auto">` wrapping `ActionItemsTable` needs:
```
h-full overflow-auto [&>div>div.relative]:!overflow-visible
```

### Alternative (Cleaner) Approach

Instead of adding overrides in 4 places, fix the root cause by modifying `src/components/ui/table.tsx` line 9. Change the Table wrapper from `overflow-auto` to `overflow-visible`:

```tsx
// BEFORE (line 9):
<div className="relative w-full overflow-auto">

// AFTER:
<div className="relative w-full overflow-visible">
```

This single change fixes ALL modules at once and removes the need for the Deals-specific `[&>div.relative]:!overflow-visible` hack. The outer scroll containers in each page already handle horizontal/vertical scrolling.

**Risk assessment:** Changing the base Table component could affect tables elsewhere in the app (e.g., Settings pages, modals). However, since all table usages already have outer scroll containers, this should be safe. The `overflow-auto` on the Table wrapper was a default from shadcn/ui meant as a fallback, but in this app every table is already inside a managed scroll container.

### Recommended Approach

Use the **alternative (cleaner) approach**: modify `table.tsx` once. Then optionally remove the now-unnecessary `[&>div.relative]:!overflow-visible` from ListView.tsx for cleanliness.

### Technical Summary

| File | Change |
|------|--------|
| `src/components/ui/table.tsx` | Line 9: Change `overflow-auto` to `overflow-visible` on the Table wrapper div |
| `src/components/ListView.tsx` (optional cleanup) | Line 424: Remove `[&>div.relative]:!overflow-visible` since it's no longer needed |

### Expected Result
All modules (Contacts, Accounts, Leads, Action Items, Deals) will have properly sticky column headers that remain fixed at the top while rows scroll.

