# Offline Plan

Adjustments is the first complete offline workflow. It proves downloading, draft recovery,
submission, ordered sync and failure recovery before the same approach is added to other pages.
See [Working Offline](../working-offline/working-offline.md) for day-to-day instructions.

## Available Behavior

The app's files and all language catalogs are saved after an online visit. Home, Adjustments and
Device Events can then reopen offline, including after a browser restart. Other pages and
print/PDF actions explain that they need a connection.

At sign-in, the app downloads permitted home-facility Adjustments programs in the background.
Each program becomes ready only when its complete bundle is stored. The sidebar reports progress
and failures. Reconnect and same-user renewal refresh access and bundles; connected boot reuses
complete data younger than 30 minutes. Older complete copies remain usable offline and show
their downloaded time. A failed refresh keeps the previous complete copy.

This workflow permits a new local Adjustment, not just editing an existing server draft. Issue,
Receive, Stock On Hand, Stock Card and Physical Inventory still need their offline passes in
FM-166. Full pending-events and sync-error pages remain FM-168 and FM-169; Device Events already
provides the recovery decisions needed by the Adjustments spike.

## Data And Saves

Page data held in memory is temporary. Business data saved on the device is kept separately for
each deployment and user. The browser saves app files, runtime configuration and translations,
never API responses or tokens.

Background downloads save complete access and program copies. Opening an online page does not
make a partial download available offline. Adjustments downloads include last-known rights,
home/program context, stock summaries with referenced product versions and lots, valid reasons
and referenced barcode mappings when scanning is enabled. Full stock-card history and the full
Receive catalog are separate datasets and are not implied by Adjustments readiness.

Autosave saves editable drafts before showing Saved on this device. Checks on the saved version
stop one tab from overwriting another. Signed submission saves a fixed copy and adds it to the
events waiting to send. Refreshing server data never overwrites local edits or signed events.
Sign-in information and preferences are kept separately from business records and device work.

## Delivery And Recovery

Only one tab at a time can send a user's saved events. Sending waits for a valid sign-in and
fresh access checks. Without the browser's Web Locks capability, downloads and automatic sync
are disabled; ordinary connected reads and draft saving remain available. Sending stops when the
app closes. Keep the app open.

Synced appears after the server accepts an event and that answer is saved on the device. A
definitive refusal retains the signed original and reason, with explicit Copy For Correction.
Session expiry pauses sending without deleting local work. Signing out warns and retains
committed work for the same user; a different sign-in cannot resume it.

The server cannot recognize and discard a repeated submission. A lost answer or a crash during
sending therefore leaves an uncertain event. It blocks later events only for that
facility/program. The user checks server history and chooses It Was Recorded or explicitly
confirms Send Again with the duplicate warning. The app never infers success from current stock
or retries unknown results silently. Normal server document numbers are preserved; no client
marker is substituted.

Accepted receipts and accepted draft rows are pruned after 30 days. Events waiting to send,
refusals, archived copies and retained sync errors are not pruned automatically.

## Verification And Rollout Limits

The production `/v2` browser suite has 16 scenarios covering offline restart, exact saved text,
reconnect ordering, expiry, interrupted uploads, concurrent tabs and two users. Vitest covers
refusal policy and the no-Web-Locks fallback.
Checks include English/Arabic phone/desktop views and local storage measurements. These checks
are not a guarantee for a different browser version, a managed profile or a physical phone.

Automated tests on 2026-10-15 with Playwright 1.64.1 recorded
Chromium 16 passed/0 skipped/0 failed, Chrome 13 passed/3 skipped/0 failed, Firefox
16 passed/0 skipped/0 failed, Docker Edge 16 passed/0 skipped/0 failed and Docker WebKit
15 passed/1 skipped/0 failed. Versions were Chromium 156.0.8078.4,
Chrome 152.0.7977.64, Firefox 157.0, Edge 155.0.4283.45 and WebKit 27.2.
The first Docker WebKit run had 14 passed, 1 skipped and 1 failed: the saved-access case
stayed on Sign In before reaching offline reload. A separate full WebKit rerun passed
15 with 1 skip and no failures. This intermittent sign-in failure remains unresolved; the
passing rerun does not establish a failure-free suite.
Six WebKit scenarios exercise the real worker cache: saved access, stale bundles, exact
draft restart, direct-route gates, bare shell reload and offline Submit restart. Nine pass
with service workers blocked and do not verify app-shell/offline caching. One scenario
remains skipped because worker-controlled renewal requests bypass test fixtures: same-user
renewal. That skip applies only to this Playwright/WebKit version pairing. Connected
acceptance is tested without persistent restart. The actual Safari browser and Apple devices
were not run.
The [developer verification detail](../../plans/FM-165.md#stage-9-browser-and-visual-proof-2026-10-15) records exact
versions, results and diagnostic evidence.

Use HTTPS and test the actual target devices before rollout. Browser storage is not a backup:
quotas, private browsing, clearing site data, eviction and device loss can remove work. The app
does not request persistent storage. Safari's storage policy includes pressure-based eviction;
its tracking prevention can remove script-writable data after seven days of Safari use without
interaction with the site. Home-screen app behavior has separate rules. See [WebKit storage
policy](https://webkit.org/blog/14403/updates-to-storage-policy/) and [WebKit tracking
prevention](https://webkit.org/tracking-prevention/).

Storage estimates include origin-wide overhead and app caches, not just business data. The small
two-program local fixture is a sizing floor. Typical users, large facilities, Receive's catalog
and stock-card histories need independent measurement before FM-166 rollout sizing.
