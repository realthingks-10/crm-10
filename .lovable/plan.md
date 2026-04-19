

# App Performance — Deep Audit & Fixes

## Root Causes (Confirmed via Code + Network Logs)

### 1. **Duplicate `SESSION_START` events on every page load** (HIGH)
Network logs show `log_security_event` is called **twice on every load** — once with `role:"user"` (default), then again with `role:"admin"` after the role query resolves. `SecurityProvider`'s `useEffect` re-runs when `userRole` changes from `'user'` → `'admin'`, and the dedup key `${user.id}-${userRole}` lets it through. This adds 200ms+ per page navigation and pollutes the audit log we just cleaned up.

### 2. **`useNotifications` re-fetches notifications + opens a realtime channel on EVERY page** (HIGHEST IMPACT)
`NotificationBell` renders inside `Dashboard.tsx` and uses `useNotifications()`, which:
- Fires **3 sequential queries** (count + page + unread list) on every mount
- Opens a Supabase realtime postgres_changes subscription
- Has no React Query caching — uses raw `useState` + `useEffect`

Network logs confirm: every dashboard load fires `notifications?...&offset=0&limit=50` AND `notifications?...&status=eq.unread` AND a HEAD count. Plus `useUnreadNotificationCount` in the sidebar fires its OWN HEAD count + opens its OWN realtime channel. **Two channels, four queries — every page load.**

### 3. **`useUserRole` duplicates `PermissionsContext` role fetch** (MEDIUM)
`Settings.tsx` calls `useUserRole()` which fires its OWN `user_roles` query, even though `PermissionsContext` already fetched and cached the same data. Wasted query on every Settings open.

### 4. **`useNotifications` realtime DELETE handler stale-closure bug** (MEDIUM)
The UPDATE handler at line 240 reads `notifications` from the closure (stale state), causing inaccurate unread counts and forcing extra refetches.

### 5. **Vite `manualChunks` doesn't split common React libs** (MEDIUM)
The current chunking creates `supabase`, `radix`, `recharts` chunks but bundles `react`, `react-dom`, `react-router-dom`, `react-hook-form`, `zod`, `@hookform`, `clsx`, `tailwind-merge`, `class-variance-authority` into the main bundle that loads on every page. The eager imports (`Dashboard`, `Auth`) plus `AppSidebar`, all of `@radix-ui/tooltip`, `Toaster`, `Sonner`, `TooltipProvider` make the initial JS heavier than needed.

### 6. **Eager imports pull in heavy chains** (MEDIUM)
`App.tsx` eagerly imports `AppSidebar` (which pulls `useNotifications` via `useUnreadNotificationCount` is OK, but also `AlertDialog`, multiple `Tooltip`s) and `Dashboard` (loads recharts via `YearlyRevenueSummary` lazily — good). But `useAuth` import in `App.tsx` line 7 is dead (only `ProtectedRoute`/`AuthRoute` use it inside the file) — minor.

### 7. **Settings page lazy-loads but PermissionsContext blocks paint** (LOW)
`PermissionsProvider`'s `loading` flag is `true` until both `user_roles` AND `page_permissions` resolve. `App.tsx`'s `ProtectedRoute` only waits on `useAuth`, so this isn't the blocker — but the duplicate `useUserRole` in Settings adds a third sequential query.

### 8. **`get_user_names` / `user-admin` edge function called on Action Items / Campaigns** (LOW–MEDIUM)
`useAllUsers` invokes the `user-admin` edge function (calls `auth.admin.listUsers` returning ALL 6 users) on every Action Items / Campaign page mount. Cold-start adds ~500ms per first visit. Should be cached via React Query.

### 9. **Heavy `KanbanBoard` (782 lines) loads on `/deals` first paint with no skeleton** (LOW)
Dealers wait for the deals query AND the heavy KanbanBoard JS to download/parse before seeing anything.

---

## Fix Plan

### Priority 1 — Stop duplicate session logs & duplicate notifications subscriptions

**`src/components/SecurityProvider.tsx`**
- Change dedup key from `${user.id}-${userRole}` → just `${user.id}`. The role doesn't need to be in the key — log the session ONCE per user, not once per role transition.

**`src/hooks/useNotifications.tsx`** — Refactor to use React Query
- Cache the notifications list (`staleTime: 60s`), sharing across `NotificationBell` AND `Notifications` page.
- Drop the duplicate "unread count" fetch — derive from cached notifications OR reuse `useUnreadNotificationCount`.
- Keep ONE realtime channel and invalidate the React Query cache instead of mutating local state (fixes the stale-closure UPDATE bug).
- Result: `NotificationBell` mount on Dashboard fires 0 extra requests if cache is fresh.

### Priority 2 — Eliminate redundant role/user queries

**`src/pages/Settings.tsx`**
- Replace `useUserRole()` with `usePermissions()` (already provides `userRole` + `isAdmin`, cached project-wide). Removes one query per Settings open.

**`src/hooks/useUserDisplayNames.tsx`** — Wrap `useAllUsers` in React Query
- Currently uses raw `useState` + `useEffect`, refetching on every mount. Convert to `useQuery({ queryKey: ['all-users'], staleTime: 5 * 60 * 1000 })` so Action Items / Campaigns / modals share one cached result.

### Priority 3 — Bundle splitting

**`vite.config.ts`** — Add chunk groups:
- `react-vendor`: `react`, `react-dom`, `react-router-dom`, `scheduler`
- `forms`: `react-hook-form`, `@hookform/resolvers`, `zod`
- `utils`: `clsx`, `tailwind-merge`, `class-variance-authority`, `date-fns` (already split)

This shrinks the main entry chunk so first paint is faster on every page.

### Priority 4 — Defer non-critical work

**`src/App.tsx`**
- Remove unused `useAuth` import at line 7 (dead).
- Lazy-load `AppSidebar` is overkill (it's needed immediately), but we can lazy-load `Toaster`/`Sonner` since they only render content on first toast. (Optional — small win.)

**`src/components/KanbanBoard.tsx`** — Already inside `DealsPage` (lazy). No change needed for code-split, but the deals page should render the kanban skeleton frame BEFORE the data resolves so users see structure immediately. Already fine — no change.

### Priority 5 — Optional: prefetch on hover

Add `onMouseEnter` prefetch handlers to sidebar `NavLink`s that call `import('./pages/Contacts')` etc. This warms the chunk before the user clicks.

---

## Files to Edit

| File | Change |
|------|--------|
| `src/components/SecurityProvider.tsx` | Dedup session log by user.id only (kill double SESSION_START) |
| `src/hooks/useNotifications.tsx` | Convert to React Query; share cache; fix stale-closure UPDATE bug |
| `src/pages/Settings.tsx` | Replace `useUserRole` with `usePermissions` |
| `src/hooks/useUserDisplayNames.tsx` | Wrap `useAllUsers` in React Query with 5-min cache |
| `vite.config.ts` | Add `react-vendor`, `forms`, `utils` manualChunks |
| `src/App.tsx` | Remove dead `useAuth` import; add hover-prefetch on AppSidebar nav links |
| `src/components/AppSidebar.tsx` | Add `onMouseEnter` prefetch handlers (optional, nice win) |

---

## Expected Impact

- **Eliminates 2× SESSION_START logs** per page load (saves ~200ms + DB writes)
- **Cuts redundant Supabase requests on Dashboard from 7 → 3** (notifications consolidation)
- **Cuts Settings page open from 3 sequential queries → 1 cached** (~300ms faster)
- **Cuts Action Items / Campaigns first load by ~500ms** (cached `useAllUsers`)
- **First-paint JS payload ~25–35% smaller** after bundle splitting (faster cold loads everywhere)
- **Hover-prefetch** makes nav clicks feel instant for users who hover before clicking

