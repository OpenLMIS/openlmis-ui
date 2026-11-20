# FM-2: App shell & navigation

https://openlmis.atlassian.net/browse/FM-2 · Parent: [FM-1](https://openlmis.atlassian.net/browse/FM-1) Foundation & app shell

## Scope

Add a notifications icon button to the top bar that opens a popover listing the system
notifications. Everything else in FM-2 (rights-based menu in legacy order,
breadcrumbs and titles, shared loading and errors, 404 in the shell, phone layout) is already on
master.

Not in scope:

- The admin System Notifications page (FM-155).
- "Software last updated on {date}": dropped, not needed (user, 2026-11-20).
- The language switcher: the redesigned shell puts it in the bottom left corner (sidebar footer),
  which is the intended design, not a gap (user, 2026-11-20).
- Update prompts (the sidebar already offers reload when a new build is ready).

## Summary

Legacy's top bar shows "System Notifications (N)", linking to Home where the notifications are
listed. The new UI only shows notifications in a bell on Home.

The new UI moves the notifications bell into the top bar so it is reachable from every page: it
shows the count, opens the list (title, message, author, date) in place, and shows "No System
Notifications" when there are none. Legacy's "Software last updated on" date is not carried over.

## Acceptance Criteria

| AC | How it is met | How it is checked |
|---|---|---|
| Top bar shows the notifications indicator, last updated info, user (profile), language switcher and Logout | Indicator added; avatar menu already opens Profile and Log Out; the last updated info is dropped; the language switcher sits in the bottom left corner by design (scope above) | Header tests; browser check |
| Menu in legacy order; rights-based; empty modules hidden | Shipped (FM-3, FM-15) | Existing registry tests |
| Breadcrumbs and title on every page | Shipped (FM-4) | Existing tests |
| Loading and errors consistent | Shipped (shared boundaries and fallbacks) | Existing tests |
| 404 inside the shell | Shipped (FM-6) | Existing tests |
| Desktop and phone | Bell at every width without crowding the search box or avatar | Browser check at 390, 1024, 1280 and 1440 px, sidebar expanded and collapsed, English and Arabic |
| i18n, no console errors | New strings in every catalog; console checked | Browser check |

## Legacy Today

- `openlmis-referencedata-ui` header: `openlmis-system-notifications-indicator` renders a text link
  to Home, "System Notifications (N)" or "No System Notifications" (also shown before the read
  completes), on every width, hidden offline. The service reads
  `GET /api/systemNotifications?isDisplayed=true&expand=author` once per session (promise and
  localStorage cache, cleared at login); on each navigation it only re-filters that cached list by
  active and start/expiry dates. A notice published mid-session appears after the next login.
- Home lists title, message, author name and created date, newest first, and hides the list offline.
- "Software last updated on" + the UI bundle build date, hidden at small widths (not carried over).

## Agent Brief

- **API map**: `GET /api/systemNotifications?isDisplayed=true&expand=author&page&size=100&sort=createdDate,desc`
  (any signed-in user; the existing paged reader). `GET /localeSettings` through the existing
  deployment time zone query. No new endpoints.
- **New feature `src/features/system-notifications/`**: move from `src/features/home` the reader
  (`api/api.ts`), `systemNotificationsOptions` (`api/queries.ts`), the bell component, the
  `SystemNotification` type and `sanitize-notification.ts` with their tests. Replace the Home
  `useFormatNumber` import with the shared `LocalizedCount` (or move the helper to `src/hooks`).
  Key: add `systemNotifications: createQueryKeys('systemNotifications')`, use
  `.list({ displayed: true })`; FM-155 saves will invalidate `queryKeys.systemNotifications.all`.
  Keep the reader's abort signal and session checks.
- **Who fetches**: the top bar is the only observer, with a non-throwing `useQuery` (no Suspense),
  so a failed first read can recover and a failed refetch keeps the last result. Freshness: the
  existing 30 s stale time, `refetchOnWindowFocus: true` for this query only, and a stale-aware
  `prefetchQuery(systemNotificationsOptions())` in `_protected.tsx` `beforeLoad` next to the
  existing signed-in, online preload. Navigation skips prefetch for 30 s after a failed read.
  Gate reads on `isSessionAuthenticated()`; the mounted bell's `enabled` uses `useOnline()` so
  it reacts to disconnect and reconnect, and the route prefetch uses `isOnline()`.
- **Home**: remove the bell, its loader prefetch, the `revision` prop and the import. Home Refresh
  (in `_protected.home.tsx`) also invalidates the exact displayed-list key and counts it in its
  fetching state. Dashboard reset and both cancellation paths stay on `home.all`, so leaving Home
  no longer cancels the notification read. `src/features/home` must not import the new feature.
- **Shell import**: `app-header.tsx` imports the indicator from the feature, an accepted shell
  import like the auth and reference-data ones its sibling `nav-user.tsx` already has.
- **Time zone without suspending**: notice timestamps read the deployment time zone without
  suspending: cached or stored zone, UTC fallback, `/localeSettings` fetched only online. A cold
  lookup must leave the header interactive, and opening cached notices offline makes no request.
- **Indicator UI**: icon button with the count badge inside the button (no positioned `Badge`
  className, `no-restyle`), one localized accessible name via ICU (`{count, plural, ...}` with the
  number formatted for the language), decorative icon and badge `aria-hidden`, a tooltip with the
  same name. Before the first successful read: neutral bell named "System Notifications", no count; if
  opened it shows loading, or "Could not load notifications." with Try Again after a failure. Zero
  after a successful read: no badge, name "No System Notifications", popover shows the empty
  state. A failed refetch keeps the previous count and list. Popover: existing
  `PopoverContent width="notifications"` with logical end alignment. Focus the named scrollable
  list when it is available on open so Page Down and arrow keys scroll it. Escape closes the
  popover and returns focus to the bell. No live region.
- **Offline**: show the last successful result of the current tab (including an empty list); hide
  the bell when there is none, including after an offline reload (the Query cache is in memory
  only). The reader checks connectivity before each page and retains the previous complete result
  if paging is interrupted. The query uses `networkMode: 'online'` to pause scheduled retries
  during a disconnect. The reader keeps `connectionStatus: false`, like other optional shell reads,
  so a failure specific to notifications does not change app-wide connectivity. Cached notices may
  stay visible past their expiry until the next online refresh.
- **Layout**: reserve stable space for the bell so nothing shifts; logical classes only.
- **User saves**: Edit User's `invalidateUserQueries` and Profile's `invalidateUsersAdminQueries`
  refresh `queryKeys.systemNotifications.all` in the background so changed author names appear
  without delaying either save.
- **Translations**: the indicator's name with count and its zero name, popover empty state; remove the unused `home.notifications.title`
  through `sync-translations`; every catalog.
- **Tests**: move the bell, paging and sanitizer tests (the six-request dashboard cancellation
  test stays in Home); bell state matrix: first failure then recovery, keyboard opening, named
  dialog, Escape and focus return; offline transition with stale cached data (including an empty
  list): kept while offline, no request on focus offline, refresh after reconnect; add an empty
  paged `/api/systemNotifications` response to `tests/offline/fixtures.ts`; update the zero-state test (now a visible
  bell) and names; header test for neutral, count, zero and offline states; extend
  `home-navigation.test.ts` to prove an in-flight notification read survives leaving Home; a check
  that Home Refresh refreshes the shell's key. The signed-in offline browser scenario covers
  keyboard scrolling and the bell disappearing after an offline reload. Budget for route
  tests that count `client.get` calls (the shell now reads notifications on every page).
- **Risks**: header crowding at 768 to 1024 px with the sidebar expanded; extra request on every
  route test.

## UI/UX

- Port: indicator on every page, count, zero state, title/message/author/date list.
- Improve: the list opens in place instead of navigating to Home; stale notices refresh on the next
  navigation or window focus (or at once on Home Refresh) instead of at the next login; notices
  loaded this session stay readable offline. No polling.
- Drop: the text-link form of the indicator (replaced by the bell with the same name and count),
  and "Software last updated on" (user, 2026-11-20).

## Decisions

- The language switcher stays in the bottom left corner of the redesigned shell (user, 2026-11-20).
- "Software last updated on" is not carried over: not needed (user, 2026-11-20).
- The shell imports the indicator from its feature rather than through a slot, as it already does
  for auth.

## Open Questions

- None blocking.

## Steps

1. Create `system-notifications` with the moved reader, query, type, sanitizer, component and
   tests; key factory entry; user-query invalidation.
2. Shell indicator with neutral, count, zero and offline states; `_protected.tsx` prefetch; remove
   Home's bell; Home Refresh invalidation.
3. Translations; adjust route tests; gates; browser check at 390, 1024 (sidebar expanded and
   collapsed), 1280 and 1440 px in English and Arabic: nothing clipped with a multi-digit badge.
