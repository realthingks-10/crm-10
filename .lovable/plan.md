

## Fix: Audience Section — Redesign for Clarity

### Root Cause
The table uses ONE shared column header row (Name / Industry / Title / Email / LinkedIn / Actions) for TWO different entity types (accounts and contacts). Account rows then misuse those columns:
- "Industry" column repeats on both rows (duplicate)
- "Title" column is hijacked to show region/country for accounts vs job position for contacts
- "Email" column on account row shows website globe via `colSpan={3}` hack
- Phone numbers are squeezed into name cells with emoji

This causes the mismatch shown in the screenshot.

### New Design (industry-standard pattern)

Treat the account as a **section header row** (not a data row), and only show contact-shaped data in the table columns below it.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▼ 🏢 Realthingks · Automotive · Asia / India · 🌐 · 📞 +91...   [+] [🗑]   │  ← account banner row (single colspan, no per-column data)
├────────────────┬─────────────┬──────────────┬────────────┬──────────┬───────┤
│ Contact Name   │ Title       │ Email        │ Phone      │ LinkedIn │ Act   │  ← contact-only columns
├────────────────┼─────────────┼──────────────┼────────────┼──────────┼───────┤
│ Deepak Dongare │ Intern      │ deepak@...   │ +918425... │ in       │ 🗑   │
│ Lukas S.       │ —           │ oliver@...   │ —          │ —        │ 🗑   │
└────────────────┴─────────────┴──────────────┴────────────┴──────────┴───────┘
```

### Changes to `src/components/campaigns/CampaignAudienceTable.tsx`

1. **Remove "Industry" from contact columns** — industry is an account attribute; eliminates the Automotive duplicate.
2. **Replace shared header** with contact-focused columns: `Contact Name | Title | Email | Phone | LinkedIn | Actions`.
3. **Account row becomes a banner**: single full-width cell (`colSpan={6}`) showing  
   `[chevron] 🏢 AccountName  ·  Industry  ·  Region/Country  ·  🌐 website  ·  📞 phone  ·  [n contacts badge]` — right-side action buttons (`+ Contacts`, `🗑`) aligned to the end with `justify-between`.
4. **Contact row** uses the proper 6 columns with phone as its own cell (not stuffed under name).
5. **Fix React warning**: replace `<>...</>` inside `<Collapsible asChild>` and `<CollapsibleContent asChild>` with proper `<TableBody>`-friendly fragments using `React.Fragment` keys, or drop `asChild` and render rows directly without Collapsible wrapper (use conditional rendering on `isExpanded`).
6. **"Unlinked Contacts" header row** restyled as a banner identical to account banner for visual consistency.
7. **Visual polish**:
   - Account banner row: subtle accent background (`bg-muted/40`), bold name, square badge for contact count.
   - Contact rows: indented name cell with avatar dot, normal background.
   - Tighten toolbar: search + counts on one line, action buttons right-aligned, consistent `h-8` heights.
8. **Square badge** already in place from earlier global change — keep it.
9. **Empty contacts under an expanded account**: show single inline message with "Add contacts" link, spans all 6 columns.

### What This Fixes (from your list)

| Issue | Resolution |
|---|---|
| Industry shown twice (account + contact) | Industry removed from contact columns; only on account banner |
| "Title" header showing `Asia · India` for accounts | Region/country moved to account banner; Title column now strictly contact job title |
| Email column empty on account row | Account row no longer occupies data columns |
| Website globe under wrong column | Moved to account banner alongside other account meta |
| Phone cramped under name | Dedicated Phone column for contacts; account phone shown in banner |
| Mismatched columns / colSpan hacks | Eliminated — account is banner, contacts use real columns |
| Fragment-as-asChild React warning | Refactored to valid table row structure |

### File Modified
- `src/components/campaigns/CampaignAudienceTable.tsx` (only file)

No DB or other component changes needed.

