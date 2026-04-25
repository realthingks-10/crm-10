
# Campaign Module — Deep Audit: Bugs + Industry-Standard Improvements

I read every file in `src/components/campaigns/`, `src/pages/Campaign*.tsx`, `src/hooks/useCampaigns.tsx`, and the related edge functions (`send-campaign-email`, `check-email-replies`, `email-track`, `campaign-follow-up-runner`, `ab-winner-evaluator`). Below is everything I found, grouped by **Bug** vs **Improvement**, in priority order.

---

## 🔴 BUGS (real defects causing wrong behavior or data loss)

### BUG-1 — Toast import inconsistency causes duplicate toaster systems
Several files import `toast` from `sonner` while the rest use `@/hooks/use-toast` (Radix Toaster). Both render simultaneously, causing inconsistent styling and stacking issues:
- `src/components/campaigns/CampaignStrategy.tsx`
- `src/components/campaigns/CampaignTiming.tsx`
- `src/components/campaigns/EmailComposeModal.tsx`
- `src/pages/CampaignDetail.tsx`
- `src/components/campaigns/CampaignAudienceTable.tsx` (mixes both — `toast` from `@/hooks/use-toast` AND `sonnerToast`)

**Fix:** Standardize all 5 files on `@/hooks/use-toast`. Remove `sonner` imports.

### BUG-2 — Email template form silently saves empty audience_segment
`CampaignMessage.tsx` has `emailForm.audience_segment` in state, the save payload joins it into a string, and the email-template card shows segment badges — but the **modal UI never renders any field** for the user to pick segments. The Phone-script modal *does* have segment checkboxes (`scriptForm.audience_segments`). Result: every email template is saved with `audience_segment: null`, badges never appear, and the entire segment-aware feature is dead for emails.

**Fix:** Add a segment multi-select to the Email-template modal mirroring the Phone-script modal. Source segments from `campaign_audience_segments` (see IMP-1) — fall back to a small fixed list (`Decision Maker`, `Influencer`, `End User`, `Champion`, `Other`) until segments are wired.

### BUG-3 — `signature` field saved with brittle `---SIGNATURE---` sentinel
`CampaignMessage.tsx` concatenates `${body}\n---SIGNATURE---${signature}` into the `body` column, then strips it back out on edit. This:
- pollutes Communications search results
- breaks variable substitution if a template is sent without going through the same parser
- shows the literal sentinel in any external preview that bypasses `openEmailEdit()`

**Fix:** Either add a real `signature` column on `campaign_email_templates` (migration), or just append the signature inside the body without a sentinel and stop trying to round-trip it.

### BUG-4 — `mart_complete` flag stays stale after section unmark
In `useCampaigns.tsx::updateStrategyFlag`, the recompute of `mart_complete` only runs after we pass the *new* row through the AND check. But the inline status dropdown in `Campaigns.tsx` keys "Activate allowed" off `mart_complete`, and there's a race: between the `update` to `campaign_mart` and the subsequent SELECT, both `useQuery` invalidations fire — but the `["campaigns"]` invalidation pulls **before** the `campaigns.mart_complete` write completes if the trip is slow. List can show "Activate enabled" while DB still has `mart_complete=false`, or vice versa.

**Fix:** Make the mart-complete recompute a single SQL expression: `UPDATE campaigns SET mart_complete = (SELECT message_done AND audience_done AND region_done AND timing_done FROM campaign_mart WHERE campaign_id=$1) WHERE id=$1` or wrap in an RPC. Then invalidate after.

### BUG-5 — `cloneCampaign` does NOT copy `enabled_channels` from source row, but DOES copy `primary_channel`
Line 287–288 of `useCampaigns.tsx`:
```ts
primary_channel: (source as any).primary_channel || null,
enabled_channels: (source as any).enabled_channels || ["Email", "Phone", "LinkedIn"],
```
The `||` fallback means that any campaign cloned from a source with `enabled_channels = []` (empty array) silently flips back to all-3 channels. Same bug for `tags`. Use `??` instead of `||` for arrays.

**Fix:** `enabled_channels: Array.isArray(source.enabled_channels) ? source.enabled_channels : ["Email","Phone","LinkedIn"]`.

### BUG-6 — Tracking pixel inflates open counts (counts user's own opens + Outlook safelink prefetch)
`email-track/index.ts` increments `open_count` on every pixel hit with no IP filter, no UA filter, and no dedupe window. Outlook's link-protection service and Microsoft Defender for Office 365 prefetch images server-side, so:
- One "open" is recorded ~1 second after send (Defender prefetch) before the recipient even looks
- The sender's own Outlook-Cached preview pane registers as an open
- `agg.emailStatus.Sent` is treated as "Sent threads" but `opened_at` shows ALL these false positives in the dashboard

**Fix:**
1. Reject opens older than `sent_at + 5s` (almost certainly bot prefetch).
2. Reject opens whose `User-Agent` contains "MicrosoftPreview", "GoogleImageProxy" *only when first*, OR mark them as `is_bot_open` and exclude from the dashboard.
3. Track unique opens via cookie/IP hash within a rolling window.
4. Add an `is_valid_open` boolean (already exists on `email_history`! — re-use the schema).

### BUG-7 — `EmailComposeModal` passes `attachmentSizeBytes` but never enforces the cap
Line 397 computes `attachmentSizeBytes` but it's never compared against `MAX_ATTACHMENT_BYTES = 9 MB` before the user clicks Send. The check exists only inside the edge function (`buildAttachments`), so the user clicks Send → waits for the network roundtrip → sees `errorCode: ATTACHMENT_ERROR`. Also, `m.file_size` is never populated in `campaign_materials` (column doesn't exist), so the bytes always sum to 0 — the warning would never fire even if implemented.

**Fix:** Add `file_size BIGINT` column to `campaign_materials`, populate it on upload, then surface a client-side warning before Send.

### BUG-8 — Stale-closure in `EmailComposeModal` realtime channel
The realtime subscription created in the `useEffect` at line 194 uses `queryClient.invalidateQueries(...)` from the closure. That's fine, but there's no guard against `campaignId` changing while the modal is open (e.g. user closes/reopens for a different campaign within 500ms debounce window) — the previous channel name `compose-live-${campaignId}` may not match the new one being subscribed to and the cleanup timer leaks.

**Fix:** Include `campaignId` in dep array (it already is), but also clear `timer` properly inside cleanup before new subscription.

### BUG-9 — `EmailComposeModal` send loop hard-codes 250ms throttle but ignores Microsoft Graph rate limits
Line 595: `await new Promise(res => setTimeout(res, 250));`. Graph API has a tenant-wide cap (~30/min for sandbox tenants), and a 250ms delay = 240 sends/min. Bulk send to 100 contacts will get 429-rate-limited halfway through with no retry.

**Fix:** Make delay configurable via `campaign_settings` (key: `bulk_send_delay_ms`, default 1000). Add 429 retry with exponential backoff in `send-campaign-email`.

### BUG-10 — `CampaignCommunications` re-uses query key `"monitoring"` suffix but `useCampaignDetail` uses `"detail"` — same campaign data fetched twice
Lines 225, 240, 254 use suffix `"monitoring"`. `useCampaignDetail` uses suffix `"detail"`. Both queries hit the same `campaign_communications`, `campaign_contacts`, `campaign_accounts` tables for the same `campaign_id`. Two separate cache entries, two separate fetches per page load.

**Fix:** Drop the `"monitoring"` suffix on query keys in `CampaignCommunications.tsx` so it shares cache with `useCampaignDetail`'s `"detail"` keys (or rename both to `["campaign-X", id]` only).

### BUG-11 — `CampaignDashboard` distinct-touches query loops up to 100k rows on every dashboard mount
Lines 240–267 do paginated `range()` walks of the full `campaign_communications` table for active campaigns, building Sets in memory client-side. With moderate volume (a few thousand emails per campaign × 5 active campaigns), this is 10–20 round trips per dashboard load. Cached for 60s but blocks first paint.

**Fix:** Add a SQL function `get_distinct_campaign_touches(_ids uuid[])` returning the count, called once. (We already have `get_campaign_aggregates_v2` — extend it.)

### BUG-12 — `CampaignDashboard` filter `campaignNameById` uses `c.id` but campaign list excludes archived — orphan rows in monitoring sheet show "(unknown)"
When viewing the monitoring sheet, communications from archived campaigns appear with no campaign name. The same applies to clones whose source was archived between sessions.

**Fix:** When `archiveView === "active"`, also fetch archived `id → name` minimally for any IDs missing from `campaigns` prop (a single `IN (...)` query).

### BUG-13 — `CampaignAudienceTable` realtime channel is created/destroyed every time `accountIdFilter` or `contactIdFilter` changes
Lines 116–117: `accountIdFilter = existingAccountIds.filter(Boolean).join(",")`. Every time any account is added/removed (via the realtime invalidate firing — recursive!), the dep array changes, the cleanup runs, the channel is recreated. Tight loop on bulk imports.

**Fix:** Sort + dedupe the IDs (`...new Set(existingAccountIds.filter(Boolean)).sort().join(",")`) so identical sets produce identical strings.

### BUG-14 — `CampaignTiming` lets users pick `start_date > end_date` for sub-windows but doesn't validate
Line 73 only checks fields are present. A timing window `start_date = 2026-12-01`, `end_date = 2026-01-01` saves successfully and breaks the visual timeline math (negative width).

**Fix:** Add `if (newWindow.start_date > newWindow.end_date) { toast.warning("Start must be on or before end"); return; }`.

### BUG-15 — `CampaignRegion` `parseRegions` strips legacy `[timezone:...]` from notes but never re-saves notes
If a campaign has a legacy notes string with a timezone marker, opening the Region tab parses it for display but only writes the cleaned `notes` on the *next* `persistRegions` call. If the user only views regions and leaves, the legacy marker stays in `notes` forever — and `messaging_note` still shows as a stripped-out hidden field that no UI exposes.

**Fix:** One-time migration: when the Region tab loads and detects a legacy `[timezone:` in notes, strip and save proactively.

### BUG-16 — `CampaignMessage` LinkedIn modal lacks `audience_segment` selector while phone scripts have it
Same shape as BUG-2 but for LinkedIn templates: state holds `email_type` and `body`, but no segment selector. LinkedIn cards never display segment badges either.

**Fix:** Add segment multi-select to LinkedIn modal too.

### BUG-17 — `CampaignDetail` auto-completes campaigns by `end_date < today` on the **client** while the DB function `auto_complete_campaigns` does it on the server — race produces double notifications/audits
The `useEffect` at `CampaignDetail.tsx:92` fires `updateCampaign` with `status: "Completed"` the moment the user opens the page. If the cron job `auto_complete_campaigns` already flipped it ~minutes earlier, this is a no-op write that still triggers `modified_at`, `modified_by` updates and any audit row.

**Fix:** Read `campaign.status` after the auto-complete cron runs (data is already cached); only call `updateCampaign` if the local row still says Active/Paused. Add `.eq("status", "Active").or("status.eq.Paused")` filter on the update so the second writer no-ops at the DB level.

### BUG-18 — `useCampaigns.cloneCampaign` clones materials by **reference** (same `file_path`) — deletion of the source campaign deletes files for both
The cloned `campaign_materials.file_path` points at storage path `${SOURCE_CAMPAIGN_ID}/...`. If the source campaign is permanently deleted later, `delete_campaign_cascade` removes the rows but storage objects remain orphaned, OR (if the user manually clears the bucket folder) the clone's downloads 404.

**Fix:** During clone, copy the storage objects to `${NEW_CAMPAIGN_ID}/...` paths and update `file_path`. Do this in the edge function or accept the limitation and add a UI warning.

### BUG-19 — `CampaignAudienceTable` "Add accounts" / "Add contacts" filters by region but not by country — multi-country campaigns over-include
Multi-country region cards (e.g. `Europe → Germany, France`) cause the Add modal to show ALL European accounts, not only those in DE/FR. The Audience tab itself filters correctly by `selectedCountries` but the Add modals don't.

**Fix:** Pass `selectedCountries` into `AddAccountsModal` / `AddContactsModal` and filter the picker server-side.

### BUG-20 — `EmailComposeModal` reply mode pre-fills body with hard-coded English signature
Line 117: `setBody("\n\n\nKind Regards,\n{owner_name}")`. There's no per-user signature setting and no template selection in reply mode (the template dropdown is shown but ignored on reply). EU/regional users get an English-only signature.

**Fix:** Pull signature from `profiles.signature` (new column) or from a chosen template; allow the user to choose a "Reply template" picker when in reply mode.

### BUG-21 — Hard-coded Phone vs Call channel mismatches all over the codebase
Old data uses `Call`, new code expects `Phone`. Normalization happens in 6+ places (`CampaignMessage.tsx:414`, `CampaignAudienceTable.tsx:66`, `CampaignCommunications.tsx:315`, `CampaignDashboard.tsx`, `CampaignModal.tsx:57`, `useCampaigns.tsx:288`). Risk: any new code that forgets to normalize will silently miscount. The `get_campaign_aggregates_v2` SQL already handles both — but inconsistencies remain in some `agg.callTouched` vs `agg.phoneTouched` spots.

**Fix:** One-time migration: `UPDATE campaign_communications SET communication_type = 'Phone' WHERE communication_type = 'Call'`. Add a CHECK constraint or trigger that rejects 'Call' going forward. Then strip all the runtime normalization helpers.

### BUG-22 — Dead files / orphaned components
- `src/components/campaigns/AIDraftEmailModal.tsx` — 109 lines, no importers (rg confirmed). Remove.
- `supabase/functions/ai-draft-campaign-email/` — referenced in older plans but `AIGenerateWizard` uses `generate-campaign-template`. Verify and delete.
- `src/utils/campaignVariables.ts::looksLikeHtml` — exported but unused.

---

## 🟡 IMPROVEMENTS — Industry-standard sales/email features that are MISSING

### IMP-1 — Audience Segments UI completely missing
Table `campaign_audience_segments` exists with RLS, JSON `filters`, RLS-managed CRUD — but **no UI ever creates, lists, or applies a segment**. This blocks BUG-2 and BUG-16.

**Build:**
- New `AudienceSegmentManager.tsx` (modal or panel inside Audience tab) with filter builder: Role contains, Industry IN, Country IN, Position contains, Seniority IN.
- "Live count" preview while editing.
- Segment chips above `CampaignAudienceTable` for one-click filter.
- Segment dropdown in email/LinkedIn template edit modals.
- "Send to segment" shortcut in `EmailComposeModal` to bulk-select all contacts matching a segment.

### IMP-2 — A/B Variant authoring UI missing (table exists, evaluator runs)
Tables `campaign_email_variants` (sent_count, open_count, click_count, reply_count, is_winner) and edge function `ab-winner-evaluator` exist and are scheduled. Zero UI.

**Build:**
- "Add Variant" button on each email template card (max 3 variants A/B/C).
- Live variant performance bars on the template card after first sends.
- Auto-pause losers when winner is picked (already auto-flagged, just need UI badge).
- Variant rotation logic in `send-campaign-email` (currently doesn't pick a variant — sends template body directly). Round-robin or weighted by performance until winner exists.

### IMP-3 — Sequences / multi-touch cadences missing
`campaign_follow_up_rules` supports a single follow-up wait + max attempts. Industry standard is a cadence: Day 1 email → Day 3 LinkedIn → Day 5 follow-up email → Day 7 phone call. Today users would have to create 3 separate rules and the runner only handles email.

**Build:**
- New `campaign_sequences` table: `step_number`, `channel`, `template_id`, `wait_after_previous_days`, `wait_unit (business|calendar)`, `is_active`.
- Visual sequence builder UI in Strategy tab: ordered list, drag to reorder, per-step channel icon, per-step wait input.
- Extend `campaign-follow-up-runner` to walk through steps in order, pick channel-appropriate sender (email vs queue a call task vs LinkedIn message draft).

### IMP-4 — Suppression / Unsubscribe list missing (CAN-SPAM, GDPR)
No `campaign_suppressions` or `email_suppressions` table. `send-campaign-email` does not check anything before sending. Industry standard:
- Tenant-wide suppression list (hard bounces, complaints, manual suppressions, `unsubscribe@` self-service)
- Per-campaign opt-outs honored across future campaigns
- One-click unsubscribe link in every outbound (legally required for marketing emails in EU/US)
- Unsubscribe edge function with token-based safe URL (no auth needed)

**Build:**
1. Migration: create `email_suppressions` (`email`, `reason`, `created_at`, `created_by`, `campaign_id?`, `expires_at?`).
2. Auto-add to suppressions on hard bounce (3 strikes), complaint, manual unsubscribe.
3. Pre-send check in `send-campaign-email`: skip + log if recipient is suppressed.
4. Unsubscribe footer in HTML body: `<a href="${SUPABASE_URL}/functions/v1/unsubscribe?t=${signedToken}">Unsubscribe</a>`.
5. New edge function `unsubscribe` (no auth) — verifies token, inserts suppression, returns confirmation page.
6. Settings UI to view/edit suppressions list.

### IMP-5 — Daily send caps per user/campaign/tenant missing
No throttle. A user could blast 5,000 emails in 5 minutes and get the tenant's Microsoft Graph token rate-limited or blocked. Industry standard is `daily_send_cap_per_user`, `daily_send_cap_per_campaign`, `cooldown_minutes_per_recipient`.

**Build:**
- Add 3 keys to `campaign_settings` table.
- Pre-send check in `send-campaign-email` counting today's sends from this user/campaign.
- UI in Admin Settings → Email Center to configure.

### IMP-6 — Per-user signature missing
Every outbound either uses an empty signature or a literal hard-coded "Kind Regards, {owner_name}". Industry standard: per-user HTML signature stored on `profiles`.

**Build:**
- Add `profiles.signature` column (HTML).
- UI in Account Settings → Profile to edit (rich-text).
- `send-campaign-email` and `campaign-follow-up-runner` append the user's signature if the template doesn't already include one.
- Removes BUG-3 (sentinel) and BUG-20 (hard-coded).

### IMP-7 — Reply intent classification missing
When a reply comes in via `check-email-replies`, it's just stored. No "is this a real reply / OOO / bounce / not-interested?" classification. The Communications tab shows all replies as positive.

**Build:**
- Add `reply_intent` column on `campaign_communications` (`positive`, `negative`, `oof`, `auto-reply`, `bounce`, `unknown`).
- Use the AI gateway (Lovable) with a small classification prompt during `check-email-replies` ingestion.
- Filter in Monitoring tab: "Show only positive replies".
- Auto-pause follow-up rule for `negative` and `oof` replies.

### IMP-8 — No visualization of which template/segment performed best
`get_campaign_widget_stats` only returns top campaigns. No template performance.

**Build:**
- New "Template Performance" card in `CampaignOverview.tsx`: top 5 templates by reply rate. Joins `campaign_email_templates` + `campaign_communications` (sent count + replied count).
- Sort/filter by segment, region, recipient role.

### IMP-9 — Outlook-style 2-pane email monitoring missing
`CampaignCommunications` Email tab is a flat scrollable list. Industry standard is thread-grouped list pane (left) + thread reader (right) with reply/forward inline. Mentioned in the older plan but never implemented.

**Build:**
- `email-monitor/ThreadList.tsx` (~35% width): paginated thread cards with status pill, unread dot, checkbox.
- `email-monitor/ThreadView.tsx` (~65% width): timeline + actions (Reply / Forward / Send Follow-up / Create Task / Mark Replied).
- Bulk actions on selected threads.
- Deep-link `?thread=<conversation_id>`.
- Responsive: <1024px, ThreadView slides up as a `Sheet`.

### IMP-10 — Bulk import contacts to a campaign missing
Adding 200 contacts requires opening the Add Contacts modal repeatedly. No CSV import or "Import from existing campaign" option.

**Build:**
- "Import from CSV" button in Audience tab toolbar.
- "Copy from another campaign" — pick a source campaign + select a subset.

### IMP-11 — Email template versioning missing
Editing a template overwrites it. No history. Easy to lose good copy.

**Build:**
- `campaign_email_template_versions` table or `versions JSONB[]` column.
- "View history" + "Restore" on edit modal.

### IMP-12 — Send-time optimization missing
All sends fire when the user clicks Send. Industry standard: schedule send for recipient's local morning (using `campaign_timing_windows` + recipient timezone).

**Build:**
- "Schedule for optimal time" toggle in `EmailComposeModal`.
- Edge function `scheduled-email-runner` fires queued sends from a `scheduled_emails` table.

### IMP-13 — Reply rate KPI in `CampaignDashboard` is vulnerable to division-by-zero edge case
Line 304: `replyRate = totalEmails > 0 ? Math.round((agg.emailStatus.Replied / totalEmails) * 100) : 0`. OK. But "totalEmails" excludes failed sends, so the rate is computed against "successfully delivered emails". The dashboard tile labels this as "Reply rate" without the qualifier, misleading users with active deliverability problems.

**Fix:** Label as "Reply rate (delivered)" with a tooltip explaining the denominator. Add a separate "Bounce rate" tile.

### IMP-14 — `CampaignActionItems` doesn't filter by status by default — closed tasks clutter
Open the Action Items tab and you see every task ever created for this campaign, including completed ones. Standard would be "Open + In Progress" by default with a toggle.

**Build:** Add status filter pills, default to non-completed.

### IMP-15 — No "preview as recipient" with rendered HTML for LinkedIn / Phone scripts
Email modal has Preview tab. LinkedIn and Phone modals have no preview — variables go unsubstituted to the user reading the script.

**Build:** Add Preview tab to those modals.

### IMP-16 — `FollowUpRulesPanel` UI is hidden inside Strategy and looks like a Card while the rest of Strategy uses divided sections — visual inconsistency
Already in the user's previous correction (MART overhaul — moved away from cards). Move FollowUpRules into its own collapsible section under the Message section, matching the divided look.

### IMP-17 — Campaign Modal lacks "Tags" input despite tags column existing and being used in the list view
`CampaignModal.tsx` doesn't render tags — only the table shows them. Users can't add/edit tags from the UI.

**Build:** Add a tag input (chip-style) in `CampaignModal`.

### IMP-18 — `CampaignModal` has no "Description" character counter despite a 2000-char DB validation
`validate_campaign_record()` rejects descriptions > 2000 chars but the modal has no counter — user types 2500 chars then gets a 500 error on save.

**Fix:** Add inline character counter (e.g. `1245 / 2000`).

### IMP-19 — `CampaignAudienceTable` has no "select multiple → bulk remove" operation
Removing 50 misplaced contacts requires 50 individual confirms. Industry standard: checkboxes + "Remove selected".

**Build:** Add row checkboxes + bulk-remove toolbar (mirrors Campaigns list bulk actions).

### IMP-20 — Inline status dropdown shows all 4 statuses but disables disallowed ones — confusing
On `Campaigns.tsx:585`, the inline `Select` shows "Active / Paused / Completed / Draft" with disabled items the user can't pick. Better to show only valid transitions plus the current status (per `allowedTransitions()`), so dropdown looks intentional.

**Fix:** `inlineOptions = STATUS_OPTIONS.filter(o => o.value === currentStatus || allowed.includes(o.value))` (already done!) BUT then the SelectItem still has `disabled={o.value !== currentStatus && !allowed.includes(o.value)}` — redundant. Drop the disabled prop since the filter already excludes them.

---

## 🟢 SMALL POLISH

- **POL-1**: `CampaignTiming` "Add Window" form keeps state after Cancel — re-opening shows last entered values. Reset on cancel.
- **POL-2**: `CampaignRegion` "delete region" on the dropdown menu doesn't go through the AlertDialog (vs the inline trash icon which does) — inconsistent confirm UX.
- **POL-3**: `CampaignMessage` Materials section has no "rename" action — file name is fixed to upload time, can't be cleaned up.
- **POL-4**: `EmailComposeModal` reply mode shows the template dropdown but uses doesn't apply it (just pre-fills with kind regards). Either disable or make it work.
- **POL-5**: `CampaignDashboard` "Refresh" button has no spinner / loading state during the 4 invalidations.
- **POL-6**: Empty-state for "No campaigns yet" on Dashboard view should match the List view's CTA layout.
- **POL-7**: `CampaignDetail` header shows status badge + "Ended" badge stacked but no tooltip explaining why "Activate" is disabled (Strategy not complete) — only inside the dropdown.
- **POL-8**: Reply pixel and unsubscribe links should use a CDN-cacheable signed URL service so they don't burden the Supabase project quota.

---

## 📦 IMPLEMENTATION BATCHES (deliverable in default mode)

### Batch A — Critical bug fixes (no schema changes)
BUG-1, BUG-2, BUG-4, BUG-5, BUG-8, BUG-10, BUG-13, BUG-14, BUG-15, BUG-17, BUG-19, BUG-20, BUG-22, IMP-13, IMP-20.

Files:
- `src/components/campaigns/CampaignStrategy.tsx`, `CampaignTiming.tsx`, `EmailComposeModal.tsx`, `CampaignAudienceTable.tsx`, `CampaignDetail.tsx` (toast unification)
- `src/components/campaigns/CampaignMessage.tsx` (segment selectors for email + LinkedIn modals + signature handling)
- `src/hooks/useCampaigns.tsx` (clone enabled_channels fix, mart_complete recompute)
- `src/components/campaigns/AddAccountsModal.tsx`, `AddContactsModal.tsx` (country filter)
- `src/components/campaigns/CampaignDashboard.tsx` (label tooltips)
- Delete `src/components/campaigns/AIDraftEmailModal.tsx`, `supabase/functions/ai-draft-campaign-email/` (after import audit)

### Batch B — Schema-required fixes
BUG-3 (signature column), BUG-6 (is_valid_open re-use), BUG-7 (file_size column), BUG-21 (Call→Phone migration), IMP-6 (profiles.signature), IMP-18 (description counter using existing 2000 limit), IMP-17 (tags input), POL-1 to POL-8.

Migrations:
1. Add `signature TEXT` to `campaign_email_templates`.
2. Add `file_size BIGINT` to `campaign_materials`.
3. Add `signature TEXT` to `profiles`.
4. Add `is_bot_open BOOLEAN DEFAULT false` to `campaign_communications`.
5. `UPDATE campaign_communications SET communication_type = 'Phone' WHERE communication_type = 'Call'`.

### Batch C — Net-new features
- IMP-1 Audience Segments UI (manager + chips + integration into modals).
- IMP-9 Outlook-style 2-pane monitoring.
- IMP-2 A/B Variants authoring UI + send-time variant rotation.

### Batch D — Compliance + scale
- IMP-4 Suppression list + unsubscribe edge function (CAN-SPAM/GDPR).
- IMP-5 Daily send caps + per-recipient cooldown.
- BUG-9 Bulk send rate limiting + 429 retry.
- BUG-11 SQL function for distinct touches.

### Batch E — Sequences + intelligence
- IMP-3 Multi-touch cadences (`campaign_sequences`).
- IMP-7 Reply intent classification (Lovable AI).
- IMP-12 Send-time optimization (scheduled queue).
- IMP-8 Template Performance card in Overview.
- IMP-10 Bulk import to campaign (CSV + "copy from another campaign").
- IMP-11 Template versioning.
- IMP-15 Preview tab on LinkedIn / Phone modals.
- IMP-14 Default status filter on Action Items.
- IMP-16 Move FollowUpRulesPanel into Strategy as a divided section.

---

## 🧭 RECOMMENDED ORDER

1. **Batch A** — ship instantly, no DB changes, fixes user-visible breakage.
2. **Batch B** — coordinated migration + matching code, takes all of one loop.
3. **Batch C** — biggest UX win (segments + monitoring 2-pane + A/B), 1 loop each.
4. **Batch D** — compliance hardening, before any production launch.
5. **Batch E** — competitive features that make the module enterprise-grade.

After approval I'll execute Batch A first; remaining batches can each be triggered in follow-up loops.
