# Offline Plan

Adjustments was the first complete offline workflow. It proved downloading, draft recovery,
submission, ordered sync and failure recovery. Issue and Receive now use the same approach. See
[Working Offline](../working-offline/working-offline.md) for day-to-day instructions.

## Available Behavior

The app's files and all language catalogs are saved after an online visit. Home, Adjustments,
Issue, Receive, Offline Events, Stock On Hand and Stock Card summaries can then reopen offline,
including after a browser restart. Transaction history, other pages and print/PDF actions need a
connection.

At sign-in, the app downloads home-facility programs where the user can view Stock Cards.
Downloads run in the background. Offline, the Adjustments, Issue and Receive program lists show
Not Downloaded with its reason: no permission to view Stock Cards, an older download on the
device, or no download yet. Each program becomes ready only when its complete bundle is stored.
The sidebar reports progress and failures. Reconnect and same-user renewal refresh access and
bundles; connected boot reuses complete stock data younger than 30 minutes. Older complete
copies remain usable offline. A failed refresh keeps the previous complete copy. When stock on
Stock On Hand, a Stock Card or an event editor comes from the device, a notice shows when it was
downloaded. It says You're offline, or Can't reach the server when the device is connected but
the server does not answer.

Only pages that cannot load offline show Not Available Offline. If part of the app was not saved
on the device, Try Again reloads the app from the device. Other errors show the normal error page,
offline too. Offline Events lists each event's details: product, lot, destination, source or
reason, and quantity.

These workflows let you start a new Adjustment, Issue or Receive offline. Events queue and sync
in order. Issue and Receive offer no printing for queued events and open Stock On Hand. Receive
also accepts typed new lots when the user can manage lots: the event keeps the lot code and
optional expiry until the server creates the lot during sync. Physical Inventory follows later.
Unpack stays online only, as in the old UI. Stock Card history is excluded from current
downloads. Full pending-events and sync-error pages remain FM-168 and FM-169; Offline Events
already provides the recovery decisions needed by the spike.

## Data And Saves

Page data held in memory is temporary. Business data saved on the device is kept separately for
each deployment and user. The browser saves app files, runtime configuration and translations,
never API responses or tokens.

Background downloads save complete access and program copies. Opening an online page does not
make a partial download available offline. Stock downloads include last-known rights,
home/program context, stock summaries with referenced product versions and lots, valid reasons,
valid destinations and sources, and referenced barcode mappings when scanning is enabled. Full
stock-card history and the full Receive product list are separate downloads. Receive needs both
stock and its approved products, so readiness for Adjustments or Issue alone does not make
Receive ready. Its products and lots download at sign-in, including signing in after session
expiry. A normal reload reuses a complete list regardless of age. Refreshing data keeps typed
and scanned new lots in drafts.

Autosave saves editable drafts before showing Saved On This Device. Checks on the saved version
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

Headless checks cover Chromium, Chrome, Firefox and Edge on Linux. WebKit checks cover its
engine on Linux with some gaps in offline renewal testing; they do not certify Safari or
Apple devices. Safari and physical devices still need verification before rollout. English
and Arabic have been checked at phone and desktop widths. Automated checks cannot guarantee
behavior for a different browser version, managed profile or physical phone.

Use HTTPS and test the actual target devices before rollout. Browser storage is not a backup:
quotas, private browsing, clearing site data, eviction and device loss can remove work. The app
does not request persistent storage. Safari's storage policy includes pressure-based eviction;
its tracking prevention can remove script-writable data after seven days of Safari use without
interaction with the site. Home-screen app behavior has separate rules. See [WebKit storage
policy](https://webkit.org/blog/14403/updates-to-storage-policy/) and [WebKit tracking
prevention](https://webkit.org/tracking-prevention/).

Storage estimates include origin-wide overhead and app caches, not just business data. Small test datasets are a sizing floor. Typical users, large facilities, Receive's catalog
and stock-card histories need independent measurement before FM-166 rollout sizing.
