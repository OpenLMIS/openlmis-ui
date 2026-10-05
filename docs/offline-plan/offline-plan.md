# Offline Plan

How the new UI will keep working without a connection. It uses the tools the app already has,
plus local storage in the browser, and needs nothing new on the server.

## Where Things Stand

| Part | Status |
| --- | --- |
| The app opens and reloads offline after one online visit, in every language | Done (FM-175) |
| Pages say "Connect To Download This Data" instead of loading forever | Done (FM-175) |
| The sidebar says when you are offline, back online, or when an update is ready | Done (FM-175) |
| A private local database for each user and each deployment, ready for later | Done (FM-175), nothing stored yet |
| A screen whose data and drafts work offline, then sync | Planned for the offline pass after the initial online stock screens (FM-166) |

## The Tools

| Tool | What it does |
| --- | --- |
| TanStack Query | Data for pages: loading, errors, a short-lived memory cache, refetching |
| Dexie (IndexedDB) | Downloaded data, editable drafts and pending changes, kept on the device |
| Zustand | The session and shared screen state, never a second copy of business records |
| Axios | Calls the existing OpenLMIS APIs |
| vite-plugin-pwa (Workbox) | Keeps the app's own files, so it can open or reload offline |

## How a Page Reads Data

A page asks TanStack Query for its data. Behind that sits one shared load function that knows
the rules for the API and for local storage, so the page never has to switch tools.

- **Online:** fetch through Axios, keep a copy of the server's answer in Dexie, and give the
  data to the page. Also download what the workflow depends on, such as its template and
  products.
- **Offline:** data already on screen stays visible. After a reload or a browser restart, the
  app opens from its saved files and the load function reads the saved copy from Dexie.
- **Never downloaded:** say "Connect To Download This Data". A read made offline always ends
  with data, a "not available" answer or a handled error. It never leaves a page loading. Data
  missing on the device is not the same as a record missing on the server.

Query and Dexie do not keep each other up to date on their own. Our data helpers save and read
records, and update the matching Query data when something changes locally. We set that
pattern up in the first workflow before we reuse it elsewhere.

**One durable store.** Query is a memory cache that can be thrown away; Dexie holds what must
survive a restart. We do not also save the whole Query cache.

The service worker keeps only the app's own files, never API or sign-in responses. A workflow
is available offline only after one online visit and once its data has been downloaded.

## Save Locally, Sync When Possible

The first offline workflow stays narrow: editing and saving an existing draft. Submitting,
authorising and approving can follow separately.

1. The editor saves. One Dexie transaction stores the new draft revision and a pending change
   together.
2. The screen says "Saved on this device".
3. Later, when the session is valid and the device is online, a sync step reads the pending
   changes and sends them through the existing API.
4. The server accepts or rejects each one, and the result is recorded in Dexie and on screen.

"Saved on this device" means saved locally. Only an answer from the server means "Synced".

## What We Keep in Dexie

- **Three kinds of data, kept apart:** downloaded server copies, editable local drafts and
  pending changes.
- **Per deployment and user:** each deployment and each user has its own database, and each
  document keeps its facility and program.
- **A refresh from the server** never overwrites a draft that was edited on the device.
- **Saving:** a local save is committed before the screen says it succeeded, with the draft
  and its pending change written in one transaction when both change.
- **Revisions:** each save gets a revision, so the answer to an older upload can never mark
  newer edits as synced.

## Signing In and Reconnecting

- **The first sign-in needs a connection.** After that, a user who signed in before can keep
  doing permitted work on the device, using their saved rights.
- **When the session expires,** uploads pause and the app asks the user to sign in again. It
  never deletes drafts or throws the user out of the editor. This is in place since FM-14.
- **Signing out on purpose** still ends access on the device. The app warns first when there
  is unsynced work, and, since FM-14, when signing out offline.
- **After reconnecting,** once the session is valid again, eligible pending changes are sent
  through the existing APIs.
  - Each answer is recorded.
  - A rejected or conflicting change is explained, and the draft is kept.
  - A lost answer may mean the server already applied the change, so a change is only retried
    where the API makes that safe.

## Order of Work

1. **Fix sign-in handling and study the chosen API.** Settle the rules for local access, and
   check how saving, retrying and conflicts behave, and how much data one workflow needs.
   (FM-14, done.)
2. **Lay the foundation.** Cache the app's files, fail cleanly offline, show the offline state,
   and add the per-user database. (FM-175, done.)
3. **Build one working online draft screen.** Open, edit and save an existing draft against the
   real APIs, with its template and validation, through shared data functions.
4. **Add offline storage** for that screen, and prove that the app and a saved draft reopen
   offline.
5. **Add syncing.** Test reconnecting, an expired session, newer local edits and an interrupted
   upload in a real browser, and each rule in unit tests.

**Rules that never bend:**

- No saved draft is ever deleted silently.
- One user's data is never mixed with another's.
- A change whose result is unknown is never retried blindly.
- Browser storage is not a backup against losing the device or clearing the site's data.

**Later, maybe:**

- more offline workflows;
- rollout controls;
- better diagnostics;
- background sync;
- encrypted offline access for several users on one device.

Basic failure messages and recovery come with the first workflow.

## References

- [TanStack Query network modes](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
- [Dexie transactions](https://dexie.org/docs/Dexie/Dexie.transaction())
- [Vite PWA](https://vite-pwa-org.netlify.app/)

All three are free and open source; no paid service is needed.
