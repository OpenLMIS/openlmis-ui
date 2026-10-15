# Offline Plan

Adjustments is the first complete offline workflow. It proves downloading, draft recovery,
submission, ordered sync and failure recovery before the same approach is added to other pages.
See [Working Offline](../working-offline/working-offline.md) for day-to-day instructions.

## Available Behavior

The app's files and all language catalogs are saved after an online visit. Home, Adjustments
and Device Events can then reopen offline, including after a browser restart. Other pages and
print/PDF actions explain that they need a connection.

At sign-in, the app downloads permitted home-facility Adjustments programs in the background.
Each program becomes ready only when its complete bundle is stored. The sidebar reports
progress and failures. Reconnect and same-user renewal refresh access and bundles; connected
boot reuses complete data younger than 30 minutes. Older complete copies remain usable offline
and show their downloaded time. A failed refresh keeps the previous complete copy.

This workflow permits a new local Adjustment, not just editing an existing server draft.
Issue, Receive, Stock On Hand, Stock Card and Physical Inventory still need their offline
passes in FM-166. Full pending-events and sync-error pages remain FM-168 and FM-169; Device
Events already provides the recovery decisions needed by the Adjustments spike.

## Data And Saves

TanStack Query holds disposable page data in memory. Dexie (IndexedDB) is the only durable
business store, with a separate database per deployment and user. The service worker stores
app files, runtime configuration and translations, never API responses or tokens.

Only the download coordinator writes complete access and program snapshots. Ordinary online
page reads do not save partial downloads. Adjustments downloads include last-known rights,
home/program context, stock summaries with referenced product versions and lots, valid reasons
and referenced barcode mappings when scanning is enabled. Full stock-card history and the full
Receive catalog are separate datasets and are not implied by Adjustments readiness.

Autosave commits editable drafts before showing Saved on this device. Revision checks stop
one tab from overwriting another. Signed submission atomically freezes that revision and adds
an immutable queue row. Refreshing server data never overwrites local edits or signed events.
The existing session store still holds credentials and preferences; business records, rights,
drafts and queue outcomes are not persisted in localStorage.

## Delivery And Recovery

One uploader uses a database-scoped Web Lock, separate from the download lock. It sends one
stock event at a time after current-user session and fresh access checks. Without Web Locks,
downloads and automatic sync are disabled; ordinary connected reads and draft saving remain
available. There is no lease fallback or service-worker background upload. Keep the app open.

A verified server acceptance and local receipt commit establish Synced. A definitive refusal
retains the signed original and reason, with explicit Copy For Correction. Session expiry
pauses sending without deleting local work. Signing out warns and retains committed work for
the same user; a different sign-in cannot resume it.

The stock API has no idempotency key. A lost answer or a crash during sending therefore leaves
an uncertain event. It blocks later events only for that facility/program. The user checks
server history and chooses It Was Recorded or explicitly confirms Send Again with the duplicate
warning. The app never infers success from current stock or retries unknown results silently.
Normal server document numbers are preserved; no client marker is substituted.

Accepted receipts and accepted draft rows are pruned after 30 days. Queue rows, refusals,
archived copies and retained sync errors are not pruned automatically.

## Verification And Rollout Limits

The production `/v2` browser suite tests offline restart, exact saved text, reconnect ordering,
expiry, refusal, interrupted uploads, concurrent tabs, two users and the no-Web-Locks fallback.
Stage 9 records exact browser versions, results, English/Arabic phone/desktop captures and
local storage measurements in [FM-165](../../plans/FM-165.md). Engine proof is not a guarantee
for a different browser version, a managed profile or a physical phone.

The 2026-10-15 Docker follow-up ran Edge 155.0.4283.45 with all 24 scenarios passing and
WebKit 26.6 with 13 passing and 11 explicitly skipped. WebKit's run blocks service workers
because controlled requests bypass the API fixtures; its skipped coverage includes offline
shell navigation/restart and routed-XHR timeouts. This is partial engine coverage. The actual
Safari browser and Apple devices were not run. See the stage 9 notes for diagnostic evidence.

Use HTTPS and test the actual target devices before rollout. Browser storage is not a backup:
quotas, private browsing, clearing site data, eviction and device loss can remove work. The app
does not request persistent storage. Safari's storage policy includes pressure-based eviction;
its tracking prevention can remove script-writable data after seven days of Safari use without
interaction with the site. Home-screen app behavior has separate rules. See
[WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) and
[WebKit tracking prevention](https://webkit.org/tracking-prevention/).

Storage estimates include origin-wide overhead and app caches, not just business data. The
small two-program local fixture is a sizing floor. Typical users, large facilities, Receive's
catalog and stock-card histories need independent measurement before FM-166 rollout sizing.
