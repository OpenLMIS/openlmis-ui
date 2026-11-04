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

## Resumed Fix Pass (2026-11-04)

Fixes 10-21 are implemented. Fix 10 also retains the invalid marker after the user adds and
removes the only product. Fix 17 uses the documented `TableCell rowHeader` registry exception,
preserving row-header semantics without changing rendering. Fix 20 reuses the existing FM-45
URL/request and flag-off tests; the other promised workflows have focused regression tests.
Fix 21 also corrects FM-50's contradictory Create Order acceptance summary noted by the reviewer.

Focused coverage: Create Orders focus/validation/footer and final deletion; insecure list
availability; dirty batch summary status; outdated draft adoption; approval/conversion failures;
Arabic product-removal labels in tables/cards; double-click batch approval; named conversion
refusal with Release Without Order recovery; single-approver conflict and explicit Update.

The full suite, browser checks, live performance measurements, server writes, pushes and PR
creation are excluded from this pass. The batch double-click regression uses plain HTTP's
in-memory editing path; saved-copy and approval persistence remain covered by the existing
secure-origin batch workflows. Backend Release Without Order failures and deployment flags
remain outside scope.

## Reviewer Follow-Up (2026-11-04)

All F1-F17 follow-up findings were confirmed and addressed. Fresh loader adoption keeps its
pending completion through draft updates, checks the session and latest loader, and ignores
older server records. Outdated loaders also disable footer actions. Draft adoption failures
use the draft status, conflict resolution rebases stored changes, and completed editors ignore
copy lifecycle notifications.

Single captures refresh status messages and wait for grid products before reading missing
available products. Capture lives separately from saved-query readers to avoid an import
cycle. Submit and Approve have route coverage for the saved copy's new status. Copy retirement
is silent when access is unavailable; other copy errors have copy-specific text. Successful
conversion remains successful if device cleanup fails. Retirement removes only the affected
single and batch drafts and records unavailable ids on sibling copies.

Online batches use approval-list membership as well as status for editing and totals. Saved
siblings retain errors for missing, retired and revoked ids so their original batch URLs reopen
offline. The redundant Sync response update is removed.

Required order labels use the shared mark and plain placeholders. The HTTPS explanation appears
only on View and Approve lists. The duplicate grid action renderer and test-only line attribute
are removed. All five catalogs use sentence copy for the no-longer-awaiting message, with the
Portuguese, Arabic and French corrections requested by the reviewer.

Verification remains limited to touched test files, TypeScript, Biome and design-system lint.
No full suite, browser, server writes, pushes or PR creation were run in this follow-up.

## Implementation Follow-Up (2026-11-04)

Failed loader adoption reopens draft writing and Retry and exposes Update. A delayed loader
adoption cannot replace a newer Sync baseline. Single-copy captures reuse status messages;
only post-action capture forces fresh messages.

Batch retrieval and approval-list membership run in parallel and share membership with copy
capture. Definitive membership failures retain status-based online editing and show the usual
copy failure notice. Network failures retain device fallback. Old optional approval flags use
approvability semantics. Membership refusal uses the same no-longer-awaiting reason in rows
and action results, retaining its translation key until rendering.

Conversion retires each released id independently. Retirement uses a multi-entry membership
index added in database version 17, preserving version 16 data. Cleanup notices distinguish
retirement from failed replacement capture and suppress resolved draft-removal errors. All
five catalogs include the new text; Arabic terminology and European Portuguese copy agree
with their catalogs. F14 tracks actual line ids and proves only the edited line renders.

Verification covers the touched test files, translation sorting, TypeScript, Biome and
design-system lint. This pass does not push, use a browser, run the full suite or write to
servers.
