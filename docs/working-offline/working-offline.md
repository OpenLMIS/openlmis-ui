# Working Offline

Adjustments can use downloaded data, save drafts and submit events without a connection.
Home, Offline Events, downloaded home-facility Stock On Hand, saved Stock Cards and Physical
Inventory drafts opened online on this device also open offline. Transaction History, other
stock pages, administration, printing and PDF downloads need a connection.

## Before You Disconnect

Sign in while connected, using the browser and device you will take with you. Downloads run
in the background without stopping your work. Keep the app open until the download finishes.
The sidebar reports download progress and failures at every width. If a download fails, use
Retry. A previous complete download stays available. While the app stays open and visible,
older downloads refresh automatically. Failed downloads retry after increasing waits, up to
30 minutes. Retry or reconnecting starts another attempt without waiting for that delay.

Event times use your deployment's time zone. If the app cannot load that setting, it
keeps the last known zone. Without a saved zone, it shows a notice and uses UTC until the
setting is available again.

The app downloads only your home-facility programs where you have both permission to make
Adjustments and permission to view Stock Cards. Programs at other facilities and programs
without both permissions are not downloaded. A downloaded program is a snapshot of stock
at download time. The app cannot download new data while
disconnected. Wait for downloads to finish and check the sidebar for failures before leaving.

A disconnected icon marks pages that need a connection. Selecting one while offline opens
Connect To Open This Page; Close returns to the item you selected.

## Drafts And Submit Offline

Open Adjustments and choose a program. Edits save automatically. Wait for Saved On This Device
before closing the browser. If saving fails, keep the page open and use Retry. A failed save
is not confirmation that your latest edits are stored.

Reopening the same deployment in the same browser profile restores the draft for the same
signed-in user. Archived Copies lets you restore or delete saved copies. If another tab has
changed the draft, choose Load Saved Draft or Keep An Archived Copy. The app stops the stale
save so one tab cannot silently replace the other tab's work.

Submit Offline validates the lines and asks for your signature. Confirmation saves a frozen
event on the device. Event Queued confirms that it is stored, then Stock On Hand opens for that
facility and program. It shows the downloaded stock, which has not changed yet, and a note that
the event is waiting to sync. Further adjustments start a new draft.

While connected, Submit uses the same device queue. The success message appears only after
the server accepts the event and the app records that result. Acceptance opens Stock On Hand.
There is no offline print offer. If sending cannot start promptly, the app confirms Event Queued
and opens Stock On Hand too. Keep the app open for the queued event to sync.
Other tabs recognize an upload in progress, so the same event is not sent twice.

Stock On Hand shows downloaded home-facility stock and its download time. Search by product
name, code or lot and open a Stock Card from its View action. Queued events do not change
those balances until they sync and stock is downloaded again. Other facilities need a connection.

View a Stock Card while connected to save its full history on this device. The app keeps the
viewed home-facility histories for your user until a newer view replaces them. Offline, a card
without saved history shows its downloaded balance and asks you to connect to view history.
Saved history shows its own download time. A newer stock download supplies the balance without
older history lines, even when the balance and active state still agree. Missing downloads show
Not Available Offline. Reconnect to refresh stock and open histories you need.

## Physical Inventory

Before disconnecting, open the draft online in the browser and device you will use for counting.
Wait for its products and reasons to finish loading. Only drafts opened online on this device
are available offline; you cannot start a new draft without a connection.

Offline, you can enter counts and reasons, use Add Products and add new lots if you have
permission to manage lots. Scanning is off. Edits save automatically on this device. Wait for
Saved On This Device before closing the browser. Counts remain on the device after sign-out
and are available when the same user signs in again.

Save and Delete need a connection. Submit checks the counts first, then asks you to connect
before submitting. Nothing is sent automatically when the connection returns. The page keeps
your counts; reopening the draft online refreshes its stock balances.

An earlier-draft alert means this device has edited counts for a draft that is no longer the
current server draft. Those counts are kept separately and are not sent to the server or offered
in the offline draft list. Discard Earlier Counts asks for confirmation and removes that
earlier device copy.
It does not delete the current server draft.

## Reconnect And Review Offline Events

Keep the app open when you reconnect. Events send one at a time after fresh access checks.
If Sign In To Sync appears, connect and sign in again as the same user. An expired session
keeps your downloaded data, drafts and events available for local work.

Open Offline Events directly below Home in the sidebar. Its badge counts queued events,
uploads in progress, unknown results and unresolved refusals, including held work. The
Adjustments program list also links there when its events are waiting or need review.

The page shows each event's type, facility, program, occurred dates and sync status.
On phones, each event has its own card. Choose View Details in the row menu or card to see
its products, lots, quantities and reasons. Details also offers Transaction History and the
actions to remove an unsent event or resolve a refusal or unknown result. Status filters
are inside Filters.

- Queued means waiting to send. You may remove an event that has never been attempted, after
  confirmation. Removing it does not change server stock.
- Sending means an upload is in progress. Keep the app open and wait for its result.
- Refused means the server rejected the whole event. Review the full reason. Choose Retry in
  the row menu, phone card or details to send the same event again, without changing it or
  confirming again. It waits in Queued until connected with a valid session and permission.
  Success shows Synced; another refusal shows the new reason. Refused events only retry when
  you choose Retry. Copy For Correction instead makes an editable copy and keeps the original
  refusal; that original can no longer be retried. A stock-changed refusal can include backdated
  movements that would make a later balance negative.
- Needs Review means the app did not receive a reliable result. The server may have recorded it.
  Later events for that facility and program wait; other programs can continue.
- Synced means a server acceptance was recorded. Marked As Recorded By You identifies a
  manual decision rather than a server answer.

For an uncertain event, check Stock Cards and Transaction History while connected. If you
lack access, ask someone with access to check before choosing. It Was Recorded records your
choice without sending again. Send Again requires a warning because it may record the event
and change stock twice. Cancel leaves the event waiting for review. Reconnecting or restarting
never authorizes an automatic resend of an uncertain event.

## Log Out And Keep Work

Log Out warns about work saved only on this device, even while connected. Stay Logged In
keeps access. Confirming Log Out retains committed work, but signing in again needs a
connection. Only the original user can resume that user's work in the app.

Device work does not move to another computer, browser profile or deployment. Do not clear site
data, uninstall the browser or use private browsing for work you need to retain. Browser storage
is not a backup. A lost device or browser eviction can remove unsynced work.

## Limits And Support

Offline downloads and automatic sync require Web Locks and a secure connection, normally HTTPS.
Without Web Locks, connected reads and device draft saving still work, but downloads and
uploads are disabled with an explanation. Even connected Submit remains queued until you use
a supported browser environment with access to that same device database.

Browser quotas, low free space, privacy settings and storage eviction can interrupt saving.
Safari can also remove inactive sites' stored data through its tracking prevention policies.
The app does not request persistent storage and cannot promise a retention period. Sync work
regularly, and resolve warnings before removing any site data.

If saving fails, keep the editor open, free space without clearing this site's data and retry.
If a download fails, reconnect and retry; an older complete copy remains usable. If sync is
paused by changed access or a changed draft, review the event and ask support to check access
or the retained draft. Do not repeatedly submit a second copy to work around an uncertain
result. Give support the facility, program, event time and displayed status, without sharing
your password or access token.

Accepted receipts remain for 30 days. Pending events, archived copies and refusals are not
removed automatically. The server's history remains separate from the device's recent receipts.
