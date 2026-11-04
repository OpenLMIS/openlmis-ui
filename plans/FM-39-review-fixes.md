# FM-39: Requisitions Epic Review Fixes

https://openlmis.atlassian.net/browse/FM-39

## Scope

Fixes for the confirmed findings of the two whole-epic reviews (Codex, then Opus) on master
f78b0d6f. One PR. Not in scope: the simplification list (separate refactor PR), the
`BATCH_APPROVE_SCREEN` default (deployment setting, documented) and the backend 500 on Release
Without Order.

## Summary

The Requisitions screens work end to end and match legacy on counts, totals and calculations,
but the reviews found stale data after actions, offline copies that go stale or become
unreachable, a slow first open on secure sites, and a set of smaller gaps. This PR fixes them so
the epic can close.

## Fixes

### Serious

1. **Stale requisition on reopen.** `view_.$requisitionId.tsx:276,378`: `RequisitionBody` keeps
   `useState(data.record)` keyed only by user and id, so router-cached loader data shows an old
   record after Submit then Proceed on the same period, or after Back; Save/Sync then 409s.
   Fix: a fresh loader record (newer `modifiedDate` or changed status) must replace the shown
   record when the page has no unsaved local edits; with local edits, keep them and show the
   existing outdated/Update path. Add the remount key or a sync effect, whichever keeps drafts.
   Evidence: `.screenshots/FM-39-opus/legacy/` (`new-fp-after-submit-stale-1440.png`).
2. **Offline copies after actions** (match legacy `requisition.js` 206-341,
   `requisitions.service.js` 241-281): after Submit, Authorize, Approve and Reject, update the
   saved single copy (and any saved batch copy holding it) to the server's new state, or remove it
   when the user can no longer act on it, so the offline list and editors never offer stale
   actions; after Delete, Skip, Convert To Order and Release Without Order, remove the saved
   copies. Single Approve/Reject must update or drop the record from a saved batch copy.
   `view_.$requisitionId.tsx` ~715-726, convert flow (`use-convert-actions.tsx`), batch
   (`confirmBatchApproval`). Evidence: `.screenshots/FM-39-opus/offline/` (`s5`-`s7`).
3. **One failed download locks saved copies offline.** `offline-access.ts:58-69,244-249`,
   `src/lib/offline-coordinator.ts:184-197`: requisition access is accepted only at the current
   general access generation, so a failed requisition-access download after a general refresh
   hides every saved copy and its unsynced draft. Keep the last complete requisition access
   usable until a newer one completes (as stock does), while still refusing it for another owner.
   Evidence: `offline/s13.mjs`.
4. **Slow first open on HTTPS.** `offline-single.ts:85-108` (`captureSingle`), started from
   `view_.$requisitionId.tsx:227-243`: the copy refetches products under different keys, every
   available product, status messages and the unskip setting. Build the copy from the same query
   options the page uses (`ensureQueryData` on the grid's keys) and start it after the page's
   prefetches, so a 1003-line open costs the same requests as without the copy.
   Evidence: `.screenshots/FM-39-opus/react/wf-detail-*.json`.
5. **Batch grid keyboard trap.** `batch-grid.tsx:~220`: Tab stops when the next requisition is
   read-only. Tab must move to the next focusable cell or out of the grid, English and Arabic.
6. **Device draft Retry.** `use-requisition-draft.ts:~233`: a transient failure of the initial
   storage read leaves "Saving" stuck; Retry must re-run the initial read and recover.

### Minor

7. Batch with a requisition no longer awaiting approval (`offline-batch.ts:25-64`, batch route
   ~635): save copies for the others, mark that column as no longer awaiting approval with a short
   message, leave it out of totals, and never tell an online user to connect.
8. Batch Sync shows pre-sync values (`approve_.batch.tsx:455-468`): show the saved response
   before clearing drafts and before `captureBatch`; same on Approve.
9. Requisition grid typing at 100 rows (`requisition-grid.tsx:250-262,305-325`,
   `requisition-tabs.tsx:174-185`): keep per-line error objects stable and memoize rows so a
   keystroke re-renders only the edited line; target under 50 ms per keystroke at 100 rows in a
   production build.
10. Create Orders: removing a line or a requesting facility moves focus to the next row's remove
    button, or the picker when none is left (`order-editor.tsx:483-491`,
    `create-order-form.tsx:118`); required markers on Program, Requesting Facility and Supplying
    Facility as legacy; no Invalid Order marker on a new empty order until the user acts.
11. Plain HTTP: hide the Offline filter and show why copies are unavailable
    (`use-offline-copies.ts`, `requisitions-toolbar.tsx:66`, `requisitions-table.tsx:202-208`), as
    `plans/FM-191.md:340` promises.
12. Offline list status: a dirty batch draft must not freeze a copy's list status
    (`offline-copies.ts:198-201`).
13. Outdated draft: when the server changed a requisition with offline edits, show the user's
    offline values alongside the outdated notice, as legacy, not only server values.
14. Approve and Convert error text: own keys, not "for this facility"
    (`approve.tsx:92-100`, `convert.tsx:54-62`).
15. Translations: replace label + value string concatenation with ICU interpolation
    (`requisition-grid.tsx:323`, `requisition-edit-cards.tsx:80`,
    `adjustments-editor-dialog.tsx:141`, `patients-edit-cards.tsx:64`, `order-editor.tsx:504`);
    Title Case for `requisitions.requisition.no-comments`; all five catalogs.
16. Remove the comments in `tb-monthly-formulas.ts:3-27` (names carry the meaning).
17. `data-table.tsx:132` `TableCell rowHeader` is an app prop in a registry-bound file: render a
    plain `th scope="row"` or add it to the AGENTS.md allowed exceptions, whichever keeps the
    registry rule.
18. Create Orders loading footer matches the loaded footer (`create-orders_.$orderIds.tsx:128-139`).
19. AGENTS.md: name the batch grid in the wrapped-header exception; add `badge.tsx wrap="normal"`
    and `button.tsx align="between"` to the customization table.
20. Missing tests the plans promised: batch Approve double click sends one request; FM-45 sort
    and filter request params and the flag-off list; FM-47 `cannotConvertToOrderWithoutApprovedQty`;
    FM-50 single Delete Order and history replace; FM-43 conflict when another approver acted.
21. Stale plans: update `plans/FM-39.md` status, `FM-44.md`, `FM-45.md`, `FM-46.md`, `FM-41.md`,
    `FM-48.md` text that no longer matches the build (see the conventions report).

## Tests

Each bug fix starts with a failing test at the cheapest boundary (pure, hook or route workflow),
then the fix. Performance items are checked in a production build in review.

## Steps

1. Serious fixes 1-6, each with its reproducer test.
2. Minor fixes 7-19.
3. Tests 20 and plan updates 21.
