
# Make Column Headers Sticky Across All Modules

## Problem
Only the Deals list view has properly sticky column headers. The other modules (Contacts, Accounts, Leads, Action Items) either have nested scroll containers that break CSS `sticky`, or use semi-transparent backgrounds (`bg-muted/50`) that let scrolling content bleed through.

## Root Cause
The Deals ListView works because:
1. It uses a single scroll container (`overflow-scroll`) with the Table directly inside
2. The sticky header uses `bg-muted/80 backdrop-blur-sm z-20` for an opaque, polished look

The other modules fail because:
- **Contacts**: `ContactTableBody` wraps the table in an extra `overflow-auto` div, creating a nested scroll container that breaks sticky
- **Leads**: `LeadTable` also has a nested `overflow-auto` div wrapping the table
- **Accounts**: Background is only `bg-muted/50` (semi-transparent), letting content show through
- **Action Items**: Background is only `bg-muted/50`, same transparency issue

## Changes

### 1. ContactTableBody (`src/components/contact-table/ContactTableBody.tsx`)
- Line 245: Remove `overflow-auto` from the wrapper `<div>` so the parent in `ContactTable` is the sole scroll container
- Lines 247-249, 261, 283: Update all header backgrounds from `bg-muted/50` to `bg-muted/80` and change `z-10` to `z-20`, add `backdrop-blur-sm`

### 2. AccountTableBody (`src/components/account-table/AccountTableBody.tsx`)
- Line 213: Update TableHeader from `z-10 bg-muted/50` to `z-20 bg-muted/80 backdrop-blur-sm`
- Lines 215, 223, 248: Update all TableHead cells from `bg-muted/50` to `bg-muted/80`

### 3. LeadTable (`src/components/LeadTable.tsx`)
- Line 342: Remove `overflow-auto` from the inner wrapper div so the parent `overflow-auto` div (line 341) is the sole scroll container
- Line 344: Update TableHeader from `z-10` to `z-20`, add `bg-muted/80 backdrop-blur-sm`
- Lines 346, 358, 377: Update all TableHead cells from `bg-muted/50` to `bg-muted/80`

### 4. ActionItemsTable (`src/components/ActionItemsTable.tsx`)
- Line 294: Update TableHeader from `z-10` to `z-20`, add `bg-muted/80 backdrop-blur-sm`
- Line 296: Update TableHead cells from `bg-muted/50` to `bg-muted/80`

## Technical Summary

| File | Changes |
|------|---------|
| `src/components/contact-table/ContactTableBody.tsx` | Remove nested `overflow-auto`; upgrade header bg to `bg-muted/80 backdrop-blur-sm z-20` |
| `src/components/account-table/AccountTableBody.tsx` | Upgrade header bg to `bg-muted/80 backdrop-blur-sm z-20` |
| `src/components/LeadTable.tsx` | Remove nested `overflow-auto`; upgrade header bg to `bg-muted/80 backdrop-blur-sm z-20` |
| `src/components/ActionItemsTable.tsx` | Upgrade header bg to `bg-muted/80 backdrop-blur-sm z-20` |

## Result
All four modules will match the Deals list view behavior: column headers remain visible and fixed at the top while only record rows scroll vertically.
