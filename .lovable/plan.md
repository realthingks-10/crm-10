# Fix Unresponsive Form Fields in Modal Dialogs

## Problem Analysis

The user reported that when creating a task in the Account section, the form fields (particularly Select dropdowns, Calendar popovers, and other interactive elements) are not responsive/clickable.

### Root Cause

The issue is a **z-index stacking context conflict** between the Dialog component and its child components (Select, Popover, Calendar):

1. **Dialog** uses `z-50` for both the overlay and content
2. **Select/Popover/Calendar** dropdowns also use `z-50`
3. When a Select dropdown opens inside a Dialog, it renders in a portal at the same z-level as the Dialog, causing:
   - Dropdowns appearing behind the dialog overlay
   - Click events being intercepted by the overlay
   - Fields appearing unresponsive

### Affected Components

Based on analysis, these modal components use Select/Popover inside Dialogs and may have the same issue:

1. `src/components/tasks/TaskModal.tsx` - Task creation (primary issue reported)
2. `src/components/AccountModal.tsx` - Account creation/editing
3. `src/components/ContactModal.tsx` - Contact creation/editing
4. `src/components/LeadModal.tsx` - Lead creation/editing
5. `src/components/MeetingModal.tsx` - Meeting creation/editing
6. `src/components/DealForm.tsx` - Deal form fields
7. Various detail modals with editable fields

## Solution

### Approach: Increase z-index for dropdown portals inside dialogs

The fix involves updating the UI components to use higher z-index values when rendering inside dialogs. We have two options:

**Option A (Recommended): Update base UI components**
- Update `SelectContent` to use `z-[100]` instead of `z-50`
- Update `PopoverContent` to use `z-[100]` instead of `z-50`
- This fixes the issue globally for all modals

**Option B: Add `pointer-events-auto` and higher z-index per usage**
- Add `className="z-[100] pointer-events-auto"` to each SelectContent/PopoverContent inside dialogs
- More targeted but requires changes in many files

## Implementation Steps

### Step 1: Update Select Component (src/components/ui/select.tsx)
- Change `SelectContent` z-index from `z-50` to `z-[100]`
- Line 76: Update the className from `relative z-50` to `relative z-[100]`

### Step 2: Update Popover Component (src/components/ui/popover.tsx)
- Change `PopoverContent` z-index from `z-50` to `z-[100]`
- Line 20: Update the className from `z-50` to `z-[100]`

### Step 3: Update Tooltip Component (src/components/ui/tooltip.tsx)
- Verify and update TooltipContent z-index if needed (should be `z-[100]`)
- This ensures tooltips also appear above dialogs

### Step 4: Verify Calendar interactions
- The Calendar component already has `pointer-events-auto` class in TaskModal.tsx (line 641)
- Verify this pattern is applied in all modal calendar usages

## Testing Checklist

After implementation, test these scenarios across ALL modules:

- [ ] Task Modal (Accounts section):
  - [ ] Module selector dropdown works
  - [ ] Account selector dropdown works
  - [ ] Assigned To dropdown works
  - [ ] Due Date calendar picker works
  - [ ] Time selector works
  - [ ] Priority dropdown works
  - [ ] Status dropdown works

- [ ] Account Modal:
  - [ ] Region/Country dropdowns work
  - [ ] Status dropdown works
  - [ ] Industry dropdown works

- [ ] Contact Modal:
  - [ ] Account selector dropdown works
  - [ ] Contact Source dropdown works

- [ ] Lead Modal:
  - [ ] Account selector dropdown works
  - [ ] Status/Source dropdowns work

- [ ] Meeting Modal:
  - [ ] Date/Time pickers work
  - [ ] Timezone selector works
  - [ ] Contact/Lead selectors work

- [ ] Deal Form:
  - [ ] All stage-related dropdowns work
  - [ ] Date pickers work

## Critical Files for Implementation

- `src/components/ui/select.tsx` - Core Select component z-index fix
- `src/components/ui/popover.tsx` - Core Popover component z-index fix  
- `src/components/ui/tooltip.tsx` - Tooltip z-index verification
- `src/components/tasks/TaskModal.tsx` - Primary affected component to test
- `src/components/ui/dialog.tsx` - Reference for understanding the z-index structure
