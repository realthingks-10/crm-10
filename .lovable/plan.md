
# Contact Search & Deal Linking — Full Audit & Fix Plan

## Root Cause Analysis

The image shows searching "Marelli" in the Contact Name dropdown of a deal. It finds contacts because the `ContactSearchableDropdown` searches `company_name` too — which is correct. But there are two separate problems to fix:

---

## Problem 1 — The `ContactSearchableDropdown` search only shows 50 results max and searches by contact_name/company_name, but some deals have `lead_name` set to a **company name** (not a person's name)

From the database audit:

| Deal `lead_name` | Issue |
|-----------------|-------|
| `Marelli` | Company name stored as contact name — a placeholder contact `Marelli` exists in contacts table with `position: "-"` (dummy record) |
| `Antolin`, `Aptiv`, `Daichi`, `Hanon`, `Kostal`, `LG Virtualization`, `Preh`, `Vestel` | Same — company names stored as contact names, dummy contacts exist |
| `A` | Garbage placeholder contact |
| `Tobias Gruendl` | Misspelling — correct contact is `Tobias Gründl` (exists in contacts) |
| `Ritesh Metha` | Misspelling — correct contact is `Ritesh Mehta` (exists in contacts) |

## Problem 2 — 7 `lead_name` values have NO matching contact at all

These 7 people appear in deals but have **no contact record**:
| Deal `lead_name` | Deal `customer_name` | Action |
|-----------------|---------------------|--------|
| `Jagdish Mishra` | REFU Drive | Create new contact |
| `Jonatan Rydberg` | Coretura | Create new contact |
| `Leif Frendin` | Volvo AB | Create new contact |
| `Pradip Mukherjee` | CARIAD US | Create new contact |
| `Simon Burghard` | Eberspächer | Create new contact |
| `Tobias Gruendl` | Lamborghini | Fix: update deal `lead_name` to `Tobias Gründl` (contact already exists) |
| `Ritesh Metha` | Harley Davidson | Fix: update deal `lead_name` to `Ritesh Mehta` (contact already exists) |

## Problem 3 — The `ContactSearchableDropdown` search only shows 50 results

When a user types "Marelli", it filters all contacts by company_name, but there are many Marelli contacts and the first 50 shown may not include all of them. The "Showing 50 of X" message is there but the user cannot see beyond those 50 without typing more.

This is acceptable UX (the user needs to type more to narrow), but the search must also include `company_name` — which it already does. So the search itself is correct.

The real UX issue is that the **dropdown is populated by the `lead_name` field**, which sometimes holds a company name (like "Marelli") instead of a person's name. When `lead_name = "Marelli"`, the dropdown button shows "Marelli" (which is not a valid contact name), and searching finds contacts **by company_name** which works partially.

---

## Fixes

### Fix 1 — SQL: Create missing contacts for the 7 unmatched lead_names

Run SQL to insert 5 new contact records (the 2 misspellings are fixed separately):

```sql
-- 1. Jagdish Mishra (REFU Drive)
INSERT INTO contacts (contact_name, company_name, created_by)
SELECT 'Jagdish Mishra', 'REFU Drive', created_by FROM deals WHERE lead_name = 'Jagdish Mishra' LIMIT 1;

-- 2. Jonatan Rydberg (Coretura)
INSERT INTO contacts (contact_name, company_name, created_by)
SELECT 'Jonatan Rydberg', 'Coretura', created_by FROM deals WHERE lead_name = 'Jonatan Rydberg' LIMIT 1;

-- 3. Leif Frendin (Volvo AB)
INSERT INTO contacts (contact_name, company_name, created_by)
SELECT 'Leif Frendin', 'Volvo AB', created_by FROM deals WHERE lead_name = 'Leif Frendin' LIMIT 1;

-- 4. Pradip Mukherjee (CARIAD US)
INSERT INTO contacts (contact_name, company_name, created_by)
SELECT 'Pradip Mukherjee', 'CARIAD US', created_by FROM deals WHERE lead_name = 'Pradip Mukherjee' LIMIT 1;

-- 5. Simon Burghard (Eberspächer)
INSERT INTO contacts (contact_name, company_name, created_by)
SELECT 'Simon Burghard', 'Eberspächer', created_by FROM deals WHERE lead_name = 'Simon Burghard' LIMIT 1;
```

### Fix 2 — SQL: Fix misspelled lead_names in deals to match existing contacts

```sql
-- Fix "Tobias Gruendl" → "Tobias Gründl" (contact already exists)
UPDATE deals SET lead_name = 'Tobias Gründl' WHERE lead_name = 'Tobias Gruendl';

-- Fix "Ritesh Metha" → "Ritesh Mehta" (contact already exists)
UPDATE deals SET lead_name = 'Ritesh Mehta' WHERE lead_name = 'Ritesh Metha';
```

### Fix 3 — Code: Improve ContactSearchableDropdown search to show count hint and search by company_name more prominently

**File:** `src/components/ContactSearchableDropdown.tsx`

The current search filters by `contact_name`, `company_name`, `email`, and `position` — this is correct. However when a user types a company name like "Marelli" and sees results, they may not realize that the `lead_name` stored in the deal is just the company name.

The fix is to ensure the dropdown **matches on company name** even if no contact_name contains "Marelli". This already works. The remaining UX fix:
- Increase the displayed results limit from 50 → 100 for company-based searches so all Marelli contacts are visible at once
- Add a subtle note in the placeholder "Search by name or company..."

### Fix 4 — Code: Update ContactSearchableDropdown to also search by `phone_no` field removal and increase limit

**File:** `src/components/ContactSearchableDropdown.tsx` — change the `filteredContacts` slice from 50 → 100.

---

## Summary of All Changes

| # | Type | Change | Files |
|---|------|--------|-------|
| 1 | SQL (via Supabase insert tool) | Create 5 missing contacts (Jagdish Mishra, Jonatan Rydberg, Leif Frendin, Pradip Mukherjee, Simon Burghard) | Database |
| 2 | SQL (via Supabase insert tool) | Fix 2 misspelled lead_names in deals (Tobias Gruendl→Gründl, Ritesh Metha→Mehta) | Database |
| 3 | Code | Increase contact dropdown display limit from 50 → 100 results | `src/components/ContactSearchableDropdown.tsx` |
| 4 | Code | Update placeholder text to "Search by name or company..." | `src/components/ContactSearchableDropdown.tsx` |
