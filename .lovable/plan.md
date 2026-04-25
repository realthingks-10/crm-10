## Campaign Module — Remaining Work Plan

The DB + edge function foundation already shipped. Eight UI surfaces remain. Batching them so each batch leaves the app working, and so dependent surfaces ship in order.

---

### Batch 1 — Settings & Compliance UIs (ship first)

These are admin-facing, low-risk, and unblock real campaign sends.

**1.1 Email Signature Editor** — `src/components/settings/account/ProfileSection.tsx`
- New section "Email Signature" with rich-text-style textarea (HTML allowed, sanitized on save)
- Live preview pane on the right
- Saves to `profiles.email_signature`
- Default template button ("Best regards, {name} · {title}")
- Used automatically by `send-campaign-email` (already wired)

**1.2 Suppression List Manager** — new `src/components/settings/SuppressionListSettings.tsx`
- Table of all suppressed emails (paginated, searchable by email)
- Columns: Email, Reason (badge: unsubscribed / bounced / complained / manual), Source, Campaign, Added On, Actions
- "Add email" dialog (single + bulk paste)
- "Remove" action (soft-confirms, audit-logged)
- CSV export
- Admin-only (gated by `is_current_user_admin()`)
- Mounted as a new tab in `src/pages/Settings.tsx` admin panel

**1.3 Send-Cap Settings** — new `src/components/settings/SendCapSettings.tsx`
- Global cap card: hourly limit, daily limit, enabled toggle
- Per-campaign overrides table (campaign name, hourly, daily, enabled)
- "Add override" dialog with campaign picker
- Live indicator showing current usage vs cap (calls `check_send_cap` RPC)
- Mounted alongside Suppression in admin settings

---

### Batch 2 — Campaign Workflow UIs

These extend the campaign detail page with industry-standard features.

**2.1 Multi-touch Sequences UI** — new `src/components/campaigns/CampaignSequences.tsx`
- New tab in `CampaignDetail.tsx` between "Communications" and "Analytics"
- List of sequence steps (sortable, drag-to-reorder)
- Per step: channel (Email/LinkedIn/Call), wait days after previous, template picker, active toggle
- "Add step" button (max 7 steps)
- Visual timeline showing Day 0 → Day N
- Reads/writes `campaign_sequences` table
- Followed-up rows already populated by `campaign-follow-up-runner` cron

**2.2 Reply Intent Badges** — edits to `CampaignCommunications.tsx`
- For each inbound email row, show colored badge: Positive (green), Negative (red), Neutral (gray), Auto-reply (yellow), Meeting Requested (purple)
- "Classify" button on unclassified rows (calls `classify-reply-intent` edge function)
- Auto-classify on first view via `useEffect` queue (rate-limited, max 5 in flight)
- Filter dropdown above inbox: "All / Positive / Negative / Meeting Requested"

**2.3 Audience Segment Manager** — new `src/components/campaigns/CampaignSegments.tsx`
- Embedded in the existing Audience tab (collapsible "Segments" header)
- Create named segments with filters (industry, region, title contains, account size)
- Saved segments appear as clickable pills that filter the audience table
- Reads/writes existing `campaign_audience_segments` table

---

### Batch 3 — Performance & Monitoring

Heaviest changes; ship last so earlier batches stabilize first.

**3.1 Outlook-Style 2-Pane Monitoring** — rewrite `src/components/campaigns/CampaignCommunications.tsx` (currently 2,569 lines)
- Left pane (40%): scrollable thread list grouped by contact, with last message preview + status icons
- Right pane (60%): selected thread detail — full message timeline, reply box, contact card, action buttons
- Keyboard nav (j/k to move, r to reply, e to archive)
- Split current monolith into: `CommunicationsThreadList.tsx`, `CommunicationsThreadDetail.tsx`, `CommunicationsToolbar.tsx`, `useCampaignCommunications.tsx` hook
- Preserve all existing functionality (filters, bulk actions, AI compose)

**3.2 CampaignDashboard Server-Side Aggregation**
- Move client-side filtering of 100k+ communication rows into a new RPC `get_campaign_dashboard_aggregates(p_filters jsonb)`
- Returns pre-computed tiles, funnel, top campaigns, channel breakdown
- React Query with 60s stale time
- Removes the current ~2s render lag on dashboards with many campaigns

---

### Execution Order & Approval

Recommend shipping **Batch 1 in this next turn** (3 self-contained admin UIs, ~800 lines total, no risk to existing flows).
Then Batch 2, then Batch 3 — each in its own turn.

| File | Type | Batch |
|------|------|-------|
| `settings/account/ProfileSection.tsx` | edit | 1 |
| `settings/SuppressionListSettings.tsx` | new | 1 |
| `settings/SendCapSettings.tsx` | new | 1 |
| `pages/Settings.tsx` | edit (mount tabs) | 1 |
| `campaigns/CampaignSequences.tsx` | new | 2 |
| `pages/CampaignDetail.tsx` | edit (new tab) | 2 |
| `campaigns/CampaignCommunications.tsx` | edit (badges) | 2 |
| `campaigns/CampaignSegments.tsx` | new | 2 |
| `campaigns/CommunicationsThreadList.tsx` | new | 3 |
| `campaigns/CommunicationsThreadDetail.tsx` | new | 3 |
| `campaigns/CommunicationsToolbar.tsx` | new | 3 |
| `hooks/useCampaignCommunications.tsx` | new | 3 |
| migration: `get_campaign_dashboard_aggregates` RPC | new | 3 |

No new secrets, no new tables (all schema already migrated). Approve to proceed with **Batch 1**.