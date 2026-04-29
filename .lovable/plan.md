## Why new sends work but replies fail with 403

Your observation is correct and reveals the real issue. New sends and replies use **two different Microsoft Graph endpoints** with different permission requirements:

| Action | Endpoint | Required Application permission |
|---|---|---|
| New email | `POST /users/{mailbox}/sendMail` | `Mail.Send` |
| Reply (current code) | `POST /users/{mailbox}/messages/{id}/createReply` then `/send` | `Mail.ReadWrite` **AND** `Mail.Send` |

`createReply` first **reads** and **modifies** an existing message in your Sent Items to build a draft reply. Without `Mail.ReadWrite`, Graph returns **403 ErrorAccessDenied** — exactly what the logs show:

```
createReply failed against deepak.dongare@realthingks.com (403)
```

So the previous error message ("grant Mail.Send") was misleading — `Mail.Send` IS already granted (that's why new sends work). The missing permission is `Mail.ReadWrite`.

Confirmed against your data:
- `parent_comm.sender_email = deepak.dongare@realthingks.com` ✓
- `parent_comm.graph_message_id` is present ✓
- The reply target mailbox is correct, but the operation type is what's denied.

## The fix has two layers

### Layer 1 — Make replies work WITHOUT requiring `Mail.ReadWrite` (preferred)

Stop using `createReply` for threading. Instead, send a normal `POST /sendMail` and stitch the thread together using **MAPI extended properties** that Outlook and Gmail both honor for threading. Microsoft Graph rejects RFC names (`In-Reply-To`/`References`) in `internetMessageHeaders`, but the same values can be set as **`singleValueExtendedProperties`**:

| MAPI property | PidTag | Purpose |
|---|---|---|
| `String 0x1042` | `PR_IN_REPLY_TO_ID` | Sets RFC `In-Reply-To` header |
| `String 0x1039` | `PR_INTERNET_REFERENCES` | Sets RFC `References` header |
| `String 0x0070` | `PR_CONVERSATION_TOPIC` | Anchors Outlook conversation grouping |

This is a documented Microsoft Graph technique that works under plain `Mail.Send` permission — no `Mail.ReadWrite` needed. Both Outlook (native conversation view) and Gmail (RFC threading) will keep replies in the same thread.

`createReply` becomes an optional fast-path: try it first only if it succeeds; on 403/4xx, immediately fall through to `sendMail` + extended-properties (no second `createReply` retry, no fall-through error).

### Layer 2 — Honest, accurate error messaging

If `sendMail` itself eventually fails (e.g. mailbox revoked), the error must reflect what actually went wrong:

- **HTTP 403 on `/sendMail`** → "Microsoft 365 denied send access for {sender}. Ask your admin to grant `Mail.Send` Application permission and ensure the Application Access Policy includes this mailbox."
- **HTTP 403 on `/createReply` (best-effort path)** → log a warning only; do NOT surface to the user — the sendMail path takes over.
- **HTTP 4xx/5xx on `/sendMail`** → surface raw Graph error code + message (currently swallowed).

## Changes I'll make

### `supabase/functions/_shared/azure-email.ts`
1. **Rewrite `sendEmailViaGraph` reply path**:
   - Try `createReply + PATCH + send` once (best-effort, no retry against alternate mailbox).
   - On any failure (403, 404, 5xx) → fall through to `sendMail` with `singleValueExtendedProperties` carrying `PR_IN_REPLY_TO_ID`, `PR_INTERNET_REFERENCES`, and `PR_CONVERSATION_TOPIC`.
   - Build References header value as: `previousReferences + " " + parent.internetMessageId`.
   - Pass `internetMessageId` of parent into the extended-properties payload.
   - Remove the hard-fail `REPLY_THREADING_BROKEN` block — sendMail with extended props is the new fallback, not an error.
2. **Drop the misleading `Mail.Send` advice** from the createReply 403 message and replace with a concise log-only warning.
3. **Bubble up real Graph error**: when `sendMail` itself returns non-OK, return `{ success: false, errorCode: <graph code>, error: <graph message + HTTP status> }` verbatim.

### `supabase/functions/send-campaign-email/index.ts`
4. Update the user-facing error mapping at line ~668: only translate to the "grant Mail.Send" hint when the failed operation is a NEW send (no parent). For reply failures, surface the actual Graph error string (or our richer mapping when it's clearly a `Mail.ReadWrite` denial that escaped the fallback).
5. Keep the previous fix: still no shared-mailbox impersonation.

### `src/components/campaigns/EmailComposeModal.tsx`
6. Helper-text in the failure toast: distinguish "send failed" vs "thread continuity unavailable but message sent". The new flow always sends — no need for the misleading admin-permission hint on replies.

## Files touched

- `supabase/functions/_shared/azure-email.ts` — new threading strategy via extended properties
- `supabase/functions/send-campaign-email/index.ts` — context-aware error mapping
- `src/components/campaigns/EmailComposeModal.tsx` — clearer failure toast
- (optional) add a Deno test stub for the extended-properties payload shape

## What I will NOT change

- No DB schema changes.
- No changes to `daily-action-reminders` (already works — it uses `sendMail`, not `createReply`).
- No changes to `campaign-follow-up-runner` (already uses `sendMail`).
- No request to your admin to grant `Mail.ReadWrite` — the goal is to remove that requirement.

## Expected outcome

After deploy, replying inside a thread will:
1. Attempt `createReply` (silent best-effort — succeeds only if `Mail.ReadWrite` exists).
2. On any failure → fall through to `sendMail` with MAPI threading properties → message arrives, threads correctly in Outlook + Gmail.
3. Only fails (with a clear, accurate error) if Graph's `sendMail` itself rejects the request.

No more "grant Mail.Send" message when Mail.Send is already granted.
