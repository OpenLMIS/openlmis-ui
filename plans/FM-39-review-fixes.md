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
   available product, status messages and the unskip setting. Build the copy from the same grid
   query options and reuse its completed reads. Opening
   adds no duplicate grid-product requests. Missing available products are fetched after two
   animation frames and browser idle, sequentially in batches of at most 100 identities.
   A 9,000-product program can still add up to 90 orderables/search requests in the background.
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

The batch double-click regression uses plain HTTP's
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
five catalogs include the new text. The round-two pass aligns Arabic requisition terminology
with the existing الطلب/الطلبات vocabulary and uses European Portuguese. F14 tracks actual line ids
and proves only the edited line renders.

Verification covers the touched test files, translation sorting, TypeScript, Biome and
design-system lint.

## Round-Two Fix Pass (2026-11-04)

Successful single actions remove detail queries and cached route loaders, so Back and Proceed
load the current record and copy lease. Newer loader adoption disables actions until complete.
Direct Submit and Authorize return to Create/Authorize; direct Approve and Reject return to
Approve. Opening-list return state still takes precedence.

Batch retrieval additionally reads the current approval list, in parallel, paging at 100 rows
until requested membership is known or the list ends. Refused columns keep their own line and
column costs while remaining outside all-facility totals and Update actions. A failed approval
refresh retires copies and drafts when another approver has acted. Sibling errors retain the
facility and period label. Copy notices track the current identity and expected availability.

Device edits coalesce for 250 ms; navigation and actions flush the final staged edit. Retry
with no pending write reports Saved. Product completeness uses identity Sets. Plain HTTP
ignores the View offline URL filter and omits its offline column. Conversion cleanup failures
show copy-specific feedback while preserving release success.

Grid inputs read their own row values without a form field subscription per cell. Quantity
conversion and error/focus semantics remain covered by the existing interaction tests. Header
and tooltip messages are memoized; the dirty check no longer serializes the draft per key.
The unused table context is removed. Order removal focus lives inside the orders feature.

All new ICU keys appear in all five catalogs. Required Requesting Facility labels remain
visible for legacy parity, with an explicit compact-picker exception in AGENTS.md and FM-49.

Production timing uses a local 100-product harness with the actual RequisitionTabs, six numeric
inputs per row and the production stylesheet. Every browser request is fulfilled from disk;
no application server is contacted. Baseline input-to-next-frame timing over 20 edits averaged
112.1 ms (maximum 172.5 ms). The final plain-HTTP run averaged 21.7 ms (maximum 32.0 ms) over
20 edits after 10 warm-up edits; the warm-up maximum was 48.4 ms. With secure-context device
storage enabled, the final mean was 26.9 ms, maximum 36.3 ms, and warm-up maximum 42.0 ms.
Earlier concurrent verification runs had occasional 61-65 ms outliers. The final serial samples
met the 50 ms target. Timing scripts and JSON results are under
`.screenshots/FM-39-pr126/sol/`; the production app build is under its `dist/` directory.

M3 required no implementation change: the existing `ready` and `readable` guards already require
Program, added requesting facilities, a valid supplying facility and read access. Its disabled
empty state remains covered by the Create Orders workflow test. Other round-two items are
implemented and covered by focused domain, hook or route tests, with static checks for the
code moves, removed dead code, translation keys and documentation.


## Download Follow-Up (2026-11-04)

Opening captures retain newer saved single and batch server records after Sync or Approve,
including sub-millisecond modified dates, approval nodes, verification, errors and download time.
Background downloads share two transport slots. All reads enqueue before admission; the provider
with the fewest held slots goes next, rotating among ties and keeping FIFO within each provider.
New arrivals cannot take a freed slot ahead of queued reads during deferred draining.
Provider ids travel with dataset, access and time-zone request configuration. Foreground reads
keep priority. Slot draining waits until failed tasks can abort their queued sibling reads.

Task cancellation forwards the coordinator abort through ordinary AbortController listeners,
without AbortSignal.any. Background access reads use one attempt and preserve shorter endpoint
timeouts under the 20-second cap. Both Axios timeout codes produce timeout feedback.

Verification uses failing regression tests before fixes, the touched test files, TypeScript,
Biome and design-system lint. No full suite, browser, push or server writes are part of this pass.


## Requisition Performance Follow-Up (2026-11-04)

Sign-in preloads session reference queries for roles, facilities, programs, the user's record
and programs, supervisory nodes and groups. The access download consumes the same queries and
still publishes only complete owner-scoped snapshots. Picker references retain administrative
invalidation; upload permission checks remain fresh. Time-zone downloads reuse the currency
settings query, removing a second locale settings request.

View offers directly granted facilities before supervisory and partner nodes finish. Partner
choices merge when their groups arrive; linked selections never search until their facility is
offered. The combobox renders at most 50 matches. Searches default to legacy's 10 rows and retain
30 seconds of freshness, avoiding a second request when loader prefetch completes before mount.

Leaving Home cancels its query group and forwards cancellation to every dashboard request.
Requisition detail starts currency and known program/period lookups alongside the fresh record;
product identity reads still depend on that record, whose template is embedded. Proceed marks
lists stale without refetching the periods list before navigation. Batch links carry the program
and membership reads run alongside the batch and currency requests, stopping at the first page
that completes membership. Pages remain sequential so no later page is requested unnecessarily.
Create Orders keeps its removal callback stable across edits. Local dev/preview proxy connections
use HTTP or HTTPS keep-alive agents; deployed runtime traffic is unaffected.

Evidence: view-timing/new-blocked.json and legacy-idle60.json in the sibling fm39-opus-review
worktree. These changes remove measured waterfalls and duplicate reads. Unit and interaction
checks verify ordering and request counts; no new server/browser timings were collected, so the
legacy latency ceiling still needs measurement in the parent review.

## Screen Review Fix Pass (2026-11-05)

- E1: Sync and the save before Submit, Authorize, Approve, Reject and Print start complete-copy
  capture without waiting for it. The server baseline and draft flush still finish first.
  Terminal actions retire stale copies before returning; replacement capture runs independently.
  Capture failures remain visible and callbacks check the captured session before publishing.
  Regression: a pending capture cannot keep Sync locked or prevent Submit from returning.

### Screen Review Item Ledger

Tests below are focused existing suites plus the added regressions, never the full suite.

- E1: Server actions no longer await complete copies; pending-capture Sync/Submit regression and saved-copy lifecycle tests.
- E2: Already fixed by card polish: RequisitionInput and shared hidden-field text wrap sr-only labels; local English/Arabic 390px screenshots have no page overflow.
- E3: Cache column compilation, reuse calculated lines during validation, use explicit checkbox labels, and render visible rows on large pages; template, tabs, validation and offscreen-focus regressions plus production timing.
- E4: Direct Delete and Skip return to Create/Authorize; direct-Delete return regression and existing workflow tests.
- E5: Neutral discard wording without device drafts, including insecure batch pages; unavailable-device leave regression.
- A1: Adjustment cells and dialogs use editable columns, including Patients products; approver read-only dialog regression and capability/grid tests.
- A2: Direct rejection-reason links check the template flag; direct-link regression.
- A3: Exhausted reason categories disappear and return with removed selections; rejection-category regression.
- A4: Unreadable patient copy names the requisition and recovery action; empty comments are hidden without comment rights; comments regression.
- B1: Batch writes have timeout 0; request-config regression.
- B2: Batch-only row names include program, facility and period; shared row-link construction and approval-list coverage.
- B3: Missing approval program returns an empty local page and asks the user to choose a program; local-search regression.
- B4: Empty results hide selection actions; empty-list regression.
- B5: Remove duplicate access preparation; approval-loader tests.
- B6: Error titles count displayed rows and known ids become labels; missing/refused and partial-failure batch tests.
- B7: Uncertain alerts use shared flowing actions below the text; design-system lint and batch workflow tests.
- B8: Approve Anyway is unavailable offline with a reachable explanation; offline-marker regression.
- B9: Check Again announces unchanged uncertainty; lost-approval reconciliation feedback regression.
- C1: Definite Convert/Release failures clear selection and refetch, substituting selected labels for ids; refused-selection regression.
- C2: Program chosen for a drafted facility stays in draft until Search applies the pair; drafted facility/program interaction regression.
- C3: Focus returns to the list before refresh and after closing errors; refused-selection focus regression and existing successful/uncertain workflow tests.
- C4: Confirmation retains its last Convert/Release kind while closing; confirmation and retry workflows.
- C5: Already fixed by 7d3d8428: direct View search runs once, facility picker pages/searches 50; existing direct-entry search regression.
- C6: Arabic initiation-date labels and View requisition terminology are corrected; Orders consistently use orders terminology; catalog parity/type checking.
- O1: Not reproduced: a deferred, fresh supplier query after first-row removal preserves focus on b4c93bb8 too. Keep the regression, omit an unnecessary columns refactor.
- O2: Existing memoized OrderLine retained; local production harness measures 100-line typing at about 14-15ms. Supplied evidence has no numeric legacy order-typing baseline, so fresh legacy parity is not claimed.
- O3: Confirmed summary closure targets a focusable h1; order workflow tests.
- O4: Add focuses the new quantity input; Add/remove interaction regression.
- O5: Unavailable tabs use Order and a short code; surviving-draft navigation tests.
- O6: Summary Product displays the name; the separate code column retains the code; summary content assertions.
- F1: Insecure approval lists omit Offline; shared column policy and approval tests.
- F2: Offline copy wording describes stock plus requisitions and does not tell connected users to connect; all five catalogs updated.
- H1: Create/Authorize reused-key recovery asks for Search rather than an absent Update; failure-message regression.
- H2: Remove the impossible direct-offline test scenario from FM-40. Keep requireOnline because a mounted page can disconnect before Proceed.
- U1: Header/mobile copy badges replace the saving note, keep failure Retry, and hide on insecure origins; pending/failure badge regression and local screenshots.
- U2: Larger adjustment totals, semibold values and hidden Actions label with centred trash controls; adjustment dialog tests. Equivalent Stock reasons totals, header and trash alignment match.
- U3: Plain Skip label names All / This Page / None; existing single-write bulk regression and production timings below.
- U4: Bounded, two-line product/treatment labels and centred tight Skip columns, including batch grids; grid/Patients tests and local English/Arabic screenshots.

### Production Timing And Evidence

`pnpm vite build --outDir .screenshots/FM-39-fix/dist`, headless Chrome, 1003-line Essential
Meds template, 100-line order fixture. Every request is fulfilled from local files or API fixtures;
no server is contacted. Copy-only orderable batches have a fixed 500ms delay. No HTTP mutation
escapes the harness. Scripts, JSON timings and screenshots are under `.screenshots/FM-39-fix/`.

Comparison: `before-complete.json` against `verified.json`. Typing reports median of 12 inputs
and includes cold samples in the raw files. Legacy reference timings come from the supplied review,
not a fresh server run.

| Operation | Before | After |
| --- | ---: | ---: |
| Save/Sync including copy-only reads | 6482ms | 242ms |
| Typing, 10 rows | 15.30ms median | 15.55ms median |
| Typing, 100 rows | 32.25ms median | 15.00ms median |
| First input, 100 rows | 110.5ms | 34.5ms |
| Submit validation, 100 rows | 41.9ms | 29.2ms |
| Skip All, 100 rows | 229.4ms | 47.4ms |
| Skip None, 100 rows | 260.0ms | 68.2ms |
| Skip This Page, 100 rows | 236.2ms | 39.0ms |
| Order typing, 100 lines | 14.89ms mean | 14.20ms mean |

Both 10-row typing medians are below the review's approximately 17ms legacy reference; the
0.25ms difference between these local runs is measurement variation. All three 100-row Skip
actions meet the under-100ms target. The 500ms mock delay isolates copy starvation, not real
server latency. Single Sync/Submit regressions also prove actions finish while capture never resolves.

Visual fixtures cover long RHZE names at 1440/1024/390 in English/Arabic and monthly patient grids
at 1440/1024 in both languages. The page never exceeds the viewport; tables keep their own overflow.
Service workers are blocked in the harness, so its existing worker-registration `waiting` error is
a harness coverage limit; offline worker behavior was not re-tested. No changes to .offline/preview-dist.

### Final Verification

- 320 tests across 21 touched suites passed across the final focused runs and rechecks.
- `pnpm tsc --noEmit`, `pnpm check` and `pnpm lint:ds` passed with zero findings.
- All five catalog key sets match; messages are sorted and Arabic order terminology is consistent.
- No full suite, push, deployment, live-server browser session or server write. The worktree's
  `.offline/preview-dist` was not changed.

### Implementation Commits

- `293e0094` fix: FM-39 continue server actions during offline copy capture
- `b569eb59` perf: FM-39 reuse compiled requisition columns
- `dea46565` perf: FM-39 keep requisition editors responsive and copies independent
- `58fe082d` fix: FM-39 align adjustment totals and requisition controls
- `5bff9ae7` fix: FM-39 improve batch approval recovery and offline actions
- `37572fe6` fix: FM-39 preserve conversion selection recovery and focus
- `83271b82` fix: FM-39 preserve order editor focus and readable summaries
- `1c8c1a53` fix: FM-39 clarify initiation and offline copy recovery
- `4861b8c3` fix: FM-39 preserve accessible positions in large grids
- `8693e206` test: FM-39 verify unchanged approval recovery feedback


## Performance round 2

- P1: Sign-in references use normal priority, timeout, retry and session handling. Eligibility
  matches the access download (view/approve permissions or supervisory assignments). A failed
  reference leaves sibling reads alive. Page caches remain shared across normal opens.
- P2: Home reads use the two-slot background gate with cancellation signals. Router navigation
  start cancels them before destination loaders settle. The existing onLeave cleanup remains.
- P3: Batch retrieval and membership start in parallel. Rows render when retrieval finishes,
  including direct links; Approve remains disabled until current-opening membership succeeds.
  List history summaries cannot substitute for the server's quantities. Copy capture still awaits
  verified membership. A successful Sync can complete a failed opening verification.
- P4: Preserve the deliberate omission of unfinished=true. FM-40 Decisions and API mapping document
  that this GET option deletes drafts before their support start date. It is not a safe read-only
  performance optimization. Existing initiate request coverage protects its omission.
- P5: Download user/program reads bypass the session cache and offline fallback. All requisition
  download references use a fresh isolated cache, including roles, nodes and groups. Background
  timeout attempts remain one, preserving fail-fast guarantees rather than reintroducing retries.
- P6: Missing supervisory nodes raise LocalDataUnavailableError.
- P7: Node subset reads reuse completed data or foreground work only. Forced authorization reads
  explicitly bypass the covering cache; download caches are isolated from page caches.
- P8: Facility picker retains its 50-result cap with the translated shown/total search hint.
- P9: Protected layout warms requisition route chunks at idle after sign-in. It runs no loaders
  or API prefetches and cancels idle scheduling on teardown or identity change.

Focused regression checks cover request config, sibling failure isolation, preload eligibility,
Home cancellation before loader completion, batch rendering before verification, forced fresh
references, unreachable fresh reads, missing-node classification and background node isolation.

Local replay: `pnpm build`, then `node scripts/fm39-performance.mjs`. The replay fulfills production
assets and every API request inside Playwright at an invalid origin. It never starts an HTTP
server, reaches a deployment, or sends a server write. It reuses offline requisition fixtures and
median service latencies from `.screenshots/FM-39-perf/timing.json`. The baseline is the preserved
production build in that evidence directory. Results go to `mock-round2.json`. Fixture sizes,
network connection scheduling and synthetic sign-in differ from live evidence; these measurements
cannot prove the user's requirement that every step beats legacy in all three states.


Local replay results in milliseconds (one sample, before -> after):

| Step | Early sequence | Settled sequence | Warm |
| --- | ---: | ---: | ---: |
| view-picker | 1401 -> 863 | 80 -> 77 | 73 -> 132 |
| initiate-picker | 79 -> 71 | 84 -> 59 | 89 -> 104 |
| initiate-search | 875 -> 888 | 871 -> 838 | 52 -> 65 |
| approve-list | 2868 -> 2901 | 2847 -> 2881 | 97 -> 72 |
| batch-open | 2894 -> 929 | 2881 -> 859 | 3301 -> 133 |
| convert-list | 29 -> 84 | 39 -> 94 | 145 -> 98 |
| orders-options | 109 -> 64 | 111 -> 65 | 75 -> 105 |

The replay's early/settled steps run sequentially, so later pickers benefit from references
loaded by earlier steps. Warm opens revisit routes with cache present. Convert uses an empty
fixture, rather than the live approval workload. The live legacy numbers in the review remain
the acceptance targets; this replay does not replace them. The View early and batch results
still exceed the corresponding live legacy targets, and several small warm samples regress.
Acceptance of universal legacy parity remains unverified and must not be reported as passed.

Validation: 76 focused tests across six touched suites passed, plus 11 reference tests after
adding idle chunk/session coverage. Typecheck, Biome, design-system lint and the production
build passed before handoff. No full suite, server browser session, server write or push.

## Screen Fix Check K1-K8 (2026-11-05)

All eight findings were applicable at 480fb1fd. No items were skipped.

- K1: Memoize Create Orders columns by translation, layout and pending state. A ref supplies
  the current removal callback. The supplier-refresh test now forces desktop layout and checks
  focus after another query update. It fails with b4c93bb8's component and passes with the fix.
  The production Chrome keyboard reproduction also retains focus after four seconds.
- K2: The status row follows the 672px cards threshold, independently from the small-header
  breakpoint. Only the copy badge has the small-header visibility rule. Empty rows disappear;
  draft failures and Retry remain visible. Header copy badges are display-hidden on phones,
  preventing a second screen-reader copy. The 620px regression fails against the opening code.
- K3: Product names use a maximum width, three lines and a full-name title in both grids.
  The full-name accessibility regression fails before the fix.
- K4: Both Patients tables use `TableHead width="patient"`. The read-only label column measures
  208px at 1440 and 1024 in both English and Arabic. A regression rejects the unbounded header.
- K5: Memoize card rows by line and reuse the table's memoized cells. Large card pages also
  virtualize rows, retain focused neighbors for keyboard traversal and mount validation targets
  before focus reveal. Skip still updates the entire draft once. A sibling-edit regression fails
  with the opening cards; validation reveal covers both layouts. Production Chrome at 620px,
  100 rows per page: All 25ms, None 41ms, This Page 34ms, None again 37ms. The initial memo-only
  pass measured 170/554/524/759ms, so it was insufficient. Width measurement is disabled in cards.
- K6: Update adopts the fresh server record without awaiting the complete offline copy. Copy
  completion uses capture-version and session checks, with failures left in the existing notice.
  The conflict Update regression holds capture pending and fails before the change.
- K7: Calculated Losses And Adjustments remain read-only. Batch labels reuse the existing ICU
  failure-line key in all five catalogs. Error counts track failed records or requests, never
  message newlines. Exhausting a rejection category clears its form value. Arabic Skip and its
  accessible label both use تخطي. Regression tests cover calculated losses, multiline errors
  and the exhausted category returning after removal. No new translation keys are needed.
- K8: Both product grids use fixed table layout with explicit colgroups. Widths measure labels
  and the complete dataset, with cached text measurements; mounted virtual rows never determine
  widths. Batch sizing includes quantity and currency formats and grand totals. Sticky dividers
  use one-pixel shadows without adjacent duplicate borders. Footer scroll padding reserves its
  measured height, and the final body row ends at the Total row's top rather than underneath it.

### Production Browser Evidence

Scripts, logs and PNGs are in `.screenshots/FM-39-k/`. `verify.mjs` uses this worktree's
playwright-core, Chrome channel, headless, and a production build served on port 5347.
It blocks every non-GET API request except token POSTs and read-only search POSTs. No server
writes are performed. The preview is stopped after verification. Port 5200 and fm39-preview
are not used.

The five-record run verifies the four requested ids plus 074a49af-12c3-429f-b5da-ed3f9e65787c
against the current approval list. All five return AUTHORIZED or IN_APPROVAL. Measurements
sample the top, middle, bottom and top again while scrolling both axes.

| Locale | Viewport | Largest Column Width Change Before | After |
| --- | --- | --- | --- |
| English | 1440 | 25.89px | 0px |
| English | 1024 | 25.89px | 0px |
| Arabic | 1440 | 25.89px | 0px |
| Arabic | 1024 | 25.89px | 0px |

`before5-measurements.json` and `after-measurements.json` contain every column width and
last-row/footer coordinates. The scrolling assertion fails against the opening batch/table
components and passes after the fixes. Bottom screenshots are
`after-batch-1440-en-1.png`, `after-batch-1024-en-1.png`,
`after-batch-1440-ar-1.png` and `after-batch-1024-ar-1.png`.
`screens.json` records the requisition grid's stable widths and the Patients header widths;
`after-product-*` and `after-patients-*` show the TB product and read-only Patients screens.
`focus.log`, `skip-virtual.log`, `k1-b4c93bb8-red.log`, `k2-k5-red.log`, `red-layout.log`,
`red.log`, `k7-red.log` and `k7-category-red.log` preserve the focused reproductions.

Validation: 201 tests pass in the eight affected component/route/capability test files. The
final status-row adjustment also passes all seven requisition-tabs tests. `pnpm tsc --noEmit`,
`pnpm check` and `pnpm lint:ds` are clean. `pnpm sort-messages` reports all catalogs sorted;
existing translations are retained and their key sets match English. No full suite or push.

Final divider inspection also checks the unpinned narrow layout. End-cell rules retain their
normal divider there; pinned divider pseudo-elements overlap the preceding border at its
existing pixel. The focused batch route's 44 tests and all three final static checks pass.

## Performance Round Three (2026-11-05)

- R1: visible Home requests use normal priority, timeout and retry; navigation cancellation stays.
- R2: protected route entry starts authorized reference preloading before Home fills browser connections; granted users start references without waiting for user detail; Create Orders Program loads independently of facilities.
- R3: complete approval-list cache entries younger than one minute verify a list opening for the same program; background and pre-approval verification remain. Failure shows Retry and pending Approve says Verifying. A revision excludes late opening results after Sync. Query caches clear on identity changes.
- R4: Approve and Convert use legacy's ten-row default; explicit URL sizes remain.
- R5: downloads refresh assignments, roles, nodes and groups in isolation, reusing session facilities/programs and the current access reader's fresh user.
- R6: the facility list shows its own translated filtered match count inside the popup.
- R7: idle requisition chunk warming uses the same rights/supervision eligibility as reference preloading.
- R8: the supplied CPU profile identifies repeated facility sorting in Convert. Memoize that list and reuse locale collators in Convert and View; sidebar location subscribes only to pathname.
- K9: window virtualization keeps page flow, stable columns and reachable Total; device status aligns at logical end.
- U1b: move copy status from headers to the device status group, copy before draft, including cards and Patients.

Evidence is under `.screenshots/FM-39-r3/`. Timing uses the supplied harness against the local
production build and read-only test server, with non-GET API writes blocked except OAuth and
read-only searches. Measurements and any remaining slower steps are reported separately.

Safety limitation: the supplied legacy initiation harness sent one successful GET containing
`unfinished=true` during an earlier run. FM-40 documents that this flag can remove older drafts;
we cannot establish whether any draft was affected. The adapted harness removes this flag before
forwarding GETs. Final target timings cover View picker/search, batch, Convert and Create Orders;
they omit initiation and record-opening steps outside the requested performance targets.

### Final Live Timing

The 48 target contexts completed without harness errors. Values below are medians of three
runs in milliseconds. Every slower median is marked, with no tolerance threshold.
| Step | State | New (ms) | Legacy (ms) | Result |
|---|---|---:|---:|---|
| View Picker | cold-early | 214 | 119 | SLOWER |
| View Picker | cold-settled | 104 | 131 | Faster |
| View Picker | warm | 44 | 88 | Faster |
| View Search | cold-early | 1011 | 1018 | Faster |
| View Search | cold-settled | 546 | 626 | Faster |
| View Search | warm | 37 | 594 | Faster |
| Approve List | cold-early | 3768 | 3032 | SLOWER |
| Approve List | cold-settled | 2558 | 2715 | Faster |
| Approve List | warm | 61 | 2837 | Faster |
| Batch First Value | cold-early | 1631 | 1028 | SLOWER |
| Batch First Value | cold-settled | 608 | 788 | Faster |
| Batch First Value | warm | 90 | 582 | Faster |
| Batch Approve Clickable | cold-early | 1887 | 1254 | SLOWER |
| Batch Approve Clickable | cold-settled | 864 | 1055 | Faster |
| Batch Approve Clickable | warm | 353 | 843 | Faster |
| Convert List | cold-early | 5012 | 1205 | SLOWER |
| Convert List | cold-settled | 711 | 918 | Faster |
| Convert List | warm | 68 | 1690 | Faster |
| Create Orders Options | cold-early | 256 | 105 | SLOWER |
| Create Orders Options | cold-settled | 160 | 130 | SLOWER |
| Create Orders Options | warm | 96 | 144 | Faster |

Home completed in 4309, 4032 and 4973 ms (median 4309 ms), improving the reported 32-41 seconds
but remaining above the 3-4 second target. The performance gate is not satisfied: early steps
and settled Create Orders remain slower than legacy. Complete waterfalls, stubs, individual
runs and long tasks are in `timing.json`; no unsuccessful run is counted as a passing sample.

The 10 x 200 fixture recorded 30 input-to-next-frame samples: new UI p90 18.3 ms (18 mounted
rows), legacy p90 3333.6 ms (200 rows and 2000 inputs). Both used the same generated batch data
and event/animation-frame measurement. This demonstrates the requested sub-50 ms typing target
on the large fixture; it does not override the slower navigation medians above.
Final screenshots use the `pinned-batch-*` prefix; all four layouts retain fixed widths and
pinned totals, including 1024px, with the Total row reachable at the end of page scroll.

## K10, K11 And Approval Performance Follow-Up (2026-11-05)

- K10: Size columns from baseline models, formatted costs and uppercase header fonts. Reserve ten
  quantity digits, keep widths unchanged while typing and permit input text to scroll internally.
- K11: Replace virtual spacer list items with padding and item margins; retain virtual positions.
- AP1: Accept selected approval-list rows immediately, with membership retained for offline capture.
- AP2: Use saveAll records directly; retain failed records/reasons and refresh membership afterwards.
- AP3: Read all batch sizes before CSS writes and skip unchanged variables.
- AP4: Approval rows and cards subscribe to their own line draft for immediate values and errors.
  Memoized tabs defer aggregate model, totals and pager updates so they leave the urgent input render.
  Cached sorted models retain added/removed-line and save-rebase behavior.
- AP5: Drop route cache on exit and preserve unchanged membership identities during warm editing.
- AP6: Remove confirmed ids from all cached approval pages before returning to the list.
- AP7: Single Approve uses the save response and ETag without the intervening GET.
- C7: Convert uses the selection footer; no-selection dialogs and keys are removed.
- E-1: Pause new background requests during navigation and its 1.8-second quiet window. Heavy
  home-stock datasets start after lighter workers; transport limits and complete generations remain.
- E-2: The earlier Convert waterfall starts its own list GET at 48 ms and finishes near 939 ms;
  the 5012 ms observation includes later reference/download work. Route/reference reads were already
  parallel. The download gate addresses that contention without adding another list dependency.
- E-3: Already implemented: Create Orders reads cached facilities with useQuery, cached user programs
  render immediately, and idle requisition chunk warming includes Create Orders. No duplicate preload.

Production build, navigation/Approve timings, blocked writes and individual samples are stored in
`.screenshots/FM-39-r4/`. Timing results below distinguish remaining slower steps explicitly.

The early waterfall also exposed foreground node/group reads triggered by sign-in warming. Limit
that warm-up to the five picker references; node/group reads now belong to their actual page or
the gated background download. A regression test fails when warm-up starts those extra reads.

## R4 Production Validation (2026-11-05)

The performance gate remains unsatisfied. Early View, Approve, Convert and Create Orders still
have slower steps; warm batch opening also varies between the navigation and approval harnesses.
Single-record and batch typing medians remain above legacy. No failing comparison is counted as
passing. The full result table below marks every strictly slower measurement without a tolerance.

Navigation/action comparisons use one live sample per phase. Typing reports median and maximum
from seven keystrokes. The 25-row page contains 24 editable lines in the live record. Navigation
uses build c51649f6; batch navigation and the final Approve run use fcd5eec0. The intervening
change only assigns background priority to offline batch membership reads. Raw requests, timings,
blocked writes and screenshots are under `.screenshots/FM-39-r4/`.

Every non-GET API call was intercepted on both origins, except token authentication and read-only
searches. Period requests strip unfinished before transport. No server records were changed.
Production preview used port 5387 and was stopped by its recorded Vite PID.

Warm reopen retained all 25 digits and focus while delayed membership completed. The 10 x 200
fixture recorded 30 samples: React median 18 ms, p90 24.3 ms, max 44.6 ms; legacy median 1357.1 ms,
p90 3135.7 ms, max 5441 ms. Phone Skip on 99 rows took 7.9-25.6 ms, with no spacer list items.
Batch widths remained stable at 1440 and 1024 in English and Arabic. Home completed in 3827,
4384 and 4205 ms, median 4205 ms, above the 3-4 second target.

Touched tests passed. Typecheck, Biome and design-system lint passed. No full suite or push ran.

| Area | Step | Phase | New (ms) | Legacy (ms) | Result |
|---|---|---|---:|---:|---|
| Navigation | Sign-In (view) | early | 1017 | 10965 | Faster/Equal |
| Navigation | view-nav | cold-early | 130 | 120 | SLOWER |
| Navigation | view-search | cold-early | 1508 | 610 | SLOWER |
| Navigation | view-open | cold-early | 1576 | 28147 | Faster/Equal |
| Navigation | Sign-In (view) | settled | 1038 | 11100 | Faster/Equal |
| Navigation | view-nav | cold-settled | 101 | 265 | Faster/Equal |
| Navigation | view-search | cold-settled | 708 | 961 | Faster/Equal |
| Navigation | view-open | cold-settled | 1250 | 37060 | Faster/Equal |
| Navigation | view-nav | warm | 37 | 105 | Faster/Equal |
| Navigation | view-search | warm | 51 | 610 | Faster/Equal |
| Navigation | view-open | warm | 1246 | 1358 | Faster/Equal |
| Navigation | Sign-In (initiate) | early | 1030 | 15591 | Faster/Equal |
| Navigation | init-nav | cold-early | 414 | 696 | Faster/Equal |
| Navigation | init-search | cold-early | 322 | 327 | Faster/Equal |
| Navigation | Sign-In (initiate) | settled | 994 | 9923 | Faster/Equal |
| Navigation | init-nav | cold-settled | 105 | 406 | Faster/Equal |
| Navigation | init-search | cold-settled | 334 | 339 | Faster/Equal |
| Navigation | init-nav | warm | 33 | 482 | Faster/Equal |
| Navigation | init-search | warm | 34 | 589 | Faster/Equal |
| Navigation | Sign-In (approve) | early | 984 | 10098 | Faster/Equal |
| Navigation | approve-nav | cold-early | 3356 | 2681 | SLOWER |
| Navigation | approve-batch | cold-early | 1577 | 607 | SLOWER |
| Navigation | approve-enabled | cold-early | 1832 | 836 | SLOWER |
| Navigation | Sign-In (approve) | settled | 999 | 10751 | Faster/Equal |
| Navigation | approve-nav | cold-settled | 2418 | 2813 | Faster/Equal |
| Navigation | approve-batch | cold-settled | 450 | 701 | Faster/Equal |
| Navigation | approve-enabled | cold-settled | 705 | 961 | Faster/Equal |
| Navigation | approve-nav | warm | 67 | 2634 | Faster/Equal |
| Navigation | approve-batch | warm | 2326 | 669 | SLOWER |
| Navigation | approve-enabled | warm | 2584 | 935 | SLOWER |
| Navigation | Sign-In (convert) | early | 1110 | 14429 | Faster/Equal |
| Navigation | convert-nav | cold-early | 4001 | 1068 | SLOWER |
| Navigation | Sign-In (convert) | settled | 1037 | 10521 | Faster/Equal |
| Navigation | convert-nav | cold-settled | 754 | 720 | SLOWER |
| Navigation | convert-nav | warm | 63 | 650 | Faster/Equal |
| Navigation | Sign-In (orders) | early | 1066 | 10364 | Faster/Equal |
| Navigation | orders-nav | cold-early | 212 | 103 | SLOWER |
| Navigation | Sign-In (orders) | settled | 1146 | 11745 | Faster/Equal |
| Navigation | orders-nav | cold-settled | 182 | 142 | SLOWER |
| Navigation | orders-nav | warm | 95 | 155 | Faster/Equal |
| Navigation | view-option | cold-early | 460 | Unavailable | Unavailable |
| Navigation | view-option | cold-settled | 383 | Unavailable | Unavailable |
| Navigation | view-option | warm | 348 | Unavailable | Unavailable |
| Approve | Sign-In | early | 1070 | 10872 | Faster/Equal |
| Approve | list | cold-early | 3609 | 3039 | SLOWER |
| Approve | filter | cold-early | 3134 | 2934 | SLOWER |
| Approve | sort | cold-early | 2726 | 2717 | SLOWER |
| Approve | open | cold-early | 1363 | 13551 | Faster/Equal |
| Approve | open (approve-enabled) | cold-early | 1366 | 13554 | Faster/Equal |
| Approve | type-10 | cold-early | 25 | 6 | SLOWER |
| Approve | type-10 (Max) | cold-early | 30 | 33 | Faster/Equal |
| Approve | type-25 | cold-early | 16 | 9 | SLOWER |
| Approve | type-25 (Max) | cold-early | 28 | 38 | Faster/Equal |
| Approve | sync | cold-early | 1333 | 9346 | Faster/Equal |
| Approve | reject-dialog | cold-early | 22 | 48 | Faster/Equal |
| Approve | approve-dialog | cold-early | 35 | 44 | Faster/Equal |
| Approve | approve | cold-early | 2123 | 4901 | Faster/Equal |
| Approve | batch-open | cold-early | 501 | 571 | Faster/Equal |
| Approve | batch-open (approve-enabled) | cold-early | 503 | 575 | Faster/Equal |
| Approve | batch-type | cold-early | 17 | 7 | SLOWER |
| Approve | batch-type (Max) | cold-early | 24 | 18 | SLOWER |
| Approve | batch-sync | cold-early | 1581 | 1812 | Faster/Equal |
| Approve | batch-approve | cold-early | 3660 | 6156 | Faster/Equal |
| Approve | Sign-In | settled | 624 | 13222 | Faster/Equal |
| Approve | list | cold-settled | 2635 | 2987 | Faster/Equal |
| Approve | filter | cold-settled | 2483 | 2585 | Faster/Equal |
| Approve | sort | cold-settled | 2612 | 2453 | SLOWER |
| Approve | open | cold-settled | 961 | 12323 | Faster/Equal |
| Approve | open (approve-enabled) | cold-settled | 965 | 12325 | Faster/Equal |
| Approve | type-10 | cold-settled | 25 | 7 | SLOWER |
| Approve | type-10 (Max) | cold-settled | 34 | 18 | SLOWER |
| Approve | type-25 | cold-settled | 19 | 10 | SLOWER |
| Approve | type-25 (Max) | cold-settled | 25 | 33 | Faster/Equal |
| Approve | sync | cold-settled | 1332 | 6376 | Faster/Equal |
| Approve | reject-dialog | cold-settled | 15 | 49 | Faster/Equal |
| Approve | approve-dialog | cold-settled | 33 | 41 | Faster/Equal |
| Approve | approve | cold-settled | 2130 | 4555 | Faster/Equal |
| Approve | batch-open | cold-settled | 513 | 567 | Faster/Equal |
| Approve | batch-open (approve-enabled) | cold-settled | 517 | 569 | Faster/Equal |
| Approve | batch-type | cold-settled | 19 | 6 | SLOWER |
| Approve | batch-type (Max) | cold-settled | 22 | 15 | SLOWER |
| Approve | batch-sync | cold-settled | 1581 | 2038 | Faster/Equal |
| Approve | batch-approve | cold-settled | 3719 | 6248 | Faster/Equal |
| Approve | list | warm | 54 | 2364 | Faster/Equal |
| Approve | filter | warm | 203 | 3287 | Faster/Equal |
| Approve | sort | warm | 47 | 2990 | Faster/Equal |
| Approve | open | warm | 1684 | 6968 | Faster/Equal |
| Approve | open (approve-enabled) | warm | 1686 | 6970 | Faster/Equal |
| Approve | type-10 | warm | 15 | 6 | SLOWER |
| Approve | type-10 (Max) | warm | 26 | 22 | SLOWER |
| Approve | type-25 | warm | 22 | 7 | SLOWER |
| Approve | type-25 (Max) | warm | 24 | 41 | Faster/Equal |
| Approve | sync | warm | 1317 | 7147 | Faster/Equal |
| Approve | reject-dialog | warm | 12 | 46 | Faster/Equal |
| Approve | approve-dialog | warm | 34 | 41 | Faster/Equal |
| Approve | approve | warm | 2125 | 4648 | Faster/Equal |
| Approve | batch-open | warm | 473 | 530 | Faster/Equal |
| Approve | batch-open (approve-enabled) | warm | 476 | 533 | Faster/Equal |
| Approve | batch-type | warm | 20 | 12 | SLOWER |
| Approve | batch-type (Max) | warm | 23 | 19 | SLOWER |
| Approve | batch-sync | warm | 1601 | 1832 | Faster/Equal |
| Approve | batch-approve | warm | 3696 | 6119 | Faster/Equal |


## Version Conflicts, Selection And Create Orders (2026-11-05)

- MD1: replace Approve's PUT ETag adoption with a post-save GET, started alongside Approve.
  Stubbed production-browser measurement: 200/201 ms GET and 251/249 ms Approve settle in
  269/270 ms from PUT dispatch; Approve starts after 18/21 ms. Retry sends W/"11" after the first
  PUT returned W/"10". The route test holds GET pending and verifies Approve already dispatched.
- MD2: requisition PUT and transitions use timeout 0, matching batch writes and legacy.
- MD3: ambiguous save failure reconciles GET against the attempted values and field bases before
  another write. Retain later edits when GET confirms the attempted value; keep reconciliation
  pending after an unreachable GET instead of resending the stale version.
- MD4: field-level three-way recovery stores changed-field base values with local drafts, preserves
  disjoint edits and offers Yours/Server for overlapping changes. Extend the existing unindexed
  draft shape within unreleased v17. No v18, no released-data loss. Outdated drafts offer Recover
  Edits; confirmed Update remains available as an explicit discard. Comparison Close preserves edits.
- MD5: forbidden Close only closes; the uncertain-approval conflict path rebases without clearing
  additional edits. Session checks follow asynchronous reads and durable writes.
- C8: remove the separate Select All / None control and its three keys in every catalog. Keep
  header page selection, the selection footer and the editor Skip group.
- O7: Create Orders adds on pick, clears and focuses the picker, excludes added options and keeps
  removal focus. Use a narrow form with full-width fields and Create Order at the bottom end;
  Enter does not submit. Screenshots at 1440/390 in English/Arabic are in FM-39-r5.
- Warm batch: the r4 waterfall forced retrieveAll on each opening (about 1.7 s in the sampled
  waterfall). Keep batch data fresh for 60 seconds; invalidate batch caches after accepted writes.
  Preserve route gcTime 0 and stable grid identity while typing; never background-remount the editor.

Production timing uses the r4 harness copied into `.screenshots/FM-39-r5/`, port 5359, with
mutations intercepted. Three-run warm medians: First Value 2,326 -> 59 ms (59/59/61; legacy 669),
Approve Enabled 2,584 -> 314 ms (314/314/319; legacy 935). All warm First Value waterfalls have
zero new retrieval requests. Timing evidence: timing.json, warm-batch.json, approve-baseline.json.
The enabled probe includes the harness's existing 250 ms pause after the First Value probe.

Validation: only touched test files, including conflict choice, lost PUT response, retry ETag,
forbidden Close, persisted bases, warm focus, header selection and add-on-pick. Typecheck, Biome
and all design-system rules pass. Production build passes. No push or server data mutation.

## S1-S3 Measurement Follow-Up (2026-11-05)

This r6 pass supersedes the r4 timing verdicts above. The production build lives in
`.screenshots/FM-39-r6/dist`, with `BATCH_APPROVE_SCREEN` enabled in its runtime config.
The r4 harness was copied to r6 and run on port 5367. Browser interception stubs every API
mutation except OAuth and read-only POST searches. The preview independently refuses writes.
The harness removes the `unfinished` parameter before forwarding period reads.

Three fresh settled runs before implementation:

| Item | New runs (ms) | Legacy runs (ms) | New median | Legacy median | Decision |
|---|---|---|---:|---:|---|
| S1 Convert list | 716, 720, 832 | 895, 696, 703 | 720 | 703 | Small loss is in request time; retain current code |
| S2 Create Orders options | 187, 209, 195 | 140, 142, 149 | 195 | 142 | Change cached option rendering |
| S3 Approve list sort | 2498, 2290, 2279 | 2566, 2479, 2444 | 2290 | 2479 | Faster in all three runs; retain current code |

Waterfall findings:

- S1 sends the same `requisitionsForConvert?page=0&size=10` request as legacy. New requests start
  at 62-79 ms and take 619-703 ms, versus legacy starts at 50-63 ms and takes 490-531 ms.
  New rows appear 25-50 ms after the response, versus legacy's 152-301 ms. The new browser's
  recorded queue/stall time is 38-41 ms versus 3-5 ms. The local preview proxies to the live
  test server, whereas legacy calls it directly. These samples do not isolate how much of
  the request-time difference belongs to the proxy or server variability. No speculative
  application change is justified by this waterfall.
- S2 has no API calls in any measured step, but has a 51-55 ms long task. A separate CPU
  sample confirms route/form mounting and garbage collection, without a network wait.
  Use an ordinary program query with a disabled loading picker, retaining the form while
  programs load. Memoize program options, selected/requesting facilities and the route's
  rights-filtered facility list across layout renders. Keep query errors in the page boundary.
- S3 sends page 0, size 10, the same program, `emergency,desc` and `authorizedDate,asc`.
  Legacy additionally sends explicit `offline=false`. New requests begin 8-15 ms after the
  click, versus 2-3 ms in legacy, and take 2246-2442 ms. New rendering adds 17-41 ms after
  the response, versus legacy's 243-247 ms. There is no new serialized lookup or long task.

The new focused test holds program loading pending, adds a facility, then resolves programs
and checks that the facility picker remains mounted and order creation becomes available.

Final complete pass: one new/legacy sample for every navigation and Approve checkpoint in all
three phases. The early column times each non-typing checkpoint from the captured Sign In
click, including the intervening harness interactions and pauses. Settled and warm columns
use each step's own click. Typing stays per key: median and maximum are both shown, and values
below 50 ms/key count as equal. All values are milliseconds, written New / Legacy.
`n/m` means the r4 harness records that metric only for the new UI, not a failed step.

| Area | Step | Early: New / Legacy | Settled: New / Legacy | Warm: New / Legacy |
|---|---|---:|---:|---:|
| Navigation | Sign In (view) | 736 / 11103 | 1045 / 10542 | - |
| Navigation | view-nav | 1280 / 11741 | 134 / 133 **SLOWER** | 49 / 125 |
| Navigation | view-option | 1630 / n/m | 419 / n/m | 397 / n/m |
| Navigation | view-search | 3004 / 13197 | 720 / 915 | 55 / 1446 |
| Navigation | view-open | 5300 / 64965 | 686 / 6508 | 1639 / 5185 |
| Navigation | Sign In (initiate) | 1085 / 10904 | 1110 / 10558 | - |
| Navigation | init-nav | 1619 / 12048 | 134 / 346 | 38 / 652 |
| Navigation | init-search | 3051 / 13322 | 338 / 399 | 34 / 928 |
| Navigation | Sign In (approve) | 1026 / 12986 | 770 / 10370 | - |
| Navigation | approve-nav | 5344 / 15935 | 2399 / 2604 | 54 / 3198 |
| Navigation | approve-batch | 6832 / 17285 | 741 / 1813 | 61 / 520 |
| Navigation | approve-enabled | 7088 / 17544 | 1003 / 2030 | 316 / 777 |
| Navigation | Sign In (convert) | 1060 / 13964 | 1061 / 10325 | - |
| Navigation | convert-nav | 8415 / 15359 | 640 / 765 | 77 / 725 |
| Navigation | Sign In (orders) | 1045 / 10827 | 1005 / 10894 | - |
| Navigation | orders-nav | 1580 / 11260 | 191 / 138 **SLOWER** | 92 / 161 |
| Approve | Sign In | 1067 / 12938 | 1531 / 10549 | - |
| Approve | list | 6516 / 16586 | 2533 / 2469 **SLOWER** | 50 / 2631 |
| Approve | filter | 10830 / 19682 | 2392 / 2439 | 229 / 2585 |
| Approve | sort | 14556 / 22546 | 2589 / 2515 **SLOWER** | 54 / 2427 |
| Approve | open | 16797 / 57363 | 675 / 6228 | 1022 / 4565 |
| Approve | open (approve-enabled) | 16799 / 57366 | 689 / 6234 | 1027 / 4566 |
| Approve | type-10 | 20 / 5 | 17 / 4 | 26 / 3 |
| Approve | type-10 (max/key) | 29 / 20 | 28 / 15 | 29 / 12 |
| Approve | type-25 | 18 / 14 | 20 / 12 | 24 / 12 |
| Approve | type-25 (max/key) | 33 / 67 | 29 / 102 | 25 / 42 |
| Approve | sync | 25019 / 74705 | 1335 / 6669 | 1312 / 6326 |
| Approve | reject-dialog | 26380 / 76076 | 23 / 55 | 13 / 55 |
| Approve | approve-dialog | 27839 / 77495 | 37 / 39 | 31 / 45 |
| Approve | approve | 30295 / 82563 | 2118 / 4577 | 2105 / 4584 |
| Approve | batch-open | 34254 / 85041 | 463 / 588 | 458 / 543 |
| Approve | batch-open (approve-enabled) | 34259 / 85043 | 465 / 590 | 461 / 547 |
| Approve | batch-type | 19 / 14 | 22 / 12 | 17 / 9 |
| Approve | batch-type (max/key) | 25 / 18 | 24 / 19 | 27 / 18 |
| Approve | batch-sync | 39198 / 90184 | 1589 / 1847 | 1631 / 1811 |
| Approve | batch-approve | 44735 / 97695 | 3719 / 6019 | 3711 / 5989 |

Every final context and every typing-value check completed successfully. All new typing keys
were below 50 ms. Four settled steps are strictly slower; no tolerance hides the 1 ms View
navigation difference. Every comparable warm checkpoint is faster or equal.

- Create Orders remains 191 vs 138 ms settled, with no HTTP work and a 58 ms long task.
  Its warm options improve to 92 vs 161 ms. The non-suspending query and stable arrays do
  not eliminate the remaining settled route/form mounting cost; S2 performance parity
  remains outstanding.
- Final Approve list loading is 2533 vs 2469 ms: the new request starts at 62 ms and takes
  2455 ms, versus legacy 66 ms and 2154 ms. New rendering takes 16 ms versus legacy 249 ms.
- Final sorting is 2589 vs 2515 ms: new request start/duration 12/2550 ms, legacy 3/2203 ms.
  New rendering takes 27 ms versus legacy 309 ms. The earlier three-run sort comparison
  was faster in every run. Retain the current implementation, and report this live-server
  sample's loss without claiming S3 is faster in every environment.
- Final Convert is 640 vs 765 ms settled and 77 vs 725 ms warm without application changes.

Read endpoints are live. Write endpoints use the harness's equal delays in both UIs:
1 second for a single save/approve, 1.5 seconds for saveAll and 2 seconds for approveAll.
These approval timings measure client orchestration and subsequent reads, not live mutation
latency. The early baseline and CPU sample each had one download that settled as Incomplete;
all final navigation downloads settled as Ready. Only OAuth and read-only POST searches were forwarded as non-GET API requests. The independent preview guard returned 405 for a stock-event write probe.

Evidence: `.screenshots/FM-39-r6/s1-s2-before.json`, `approve/s3-before.json`,
`orders-profile.json`, `timing-final.json`, `approve/timing-final.json` and `full-report.json`.

Validation: the touched Create Orders test file passes all seven tests, including the new
pending-program regression. `pnpm tsc --noEmit`, `pnpm check`, `pnpm lint:ds` and the production
build pass. Arabic smoke checks at 1440 and 390 px pass for program selection and facility
add/remove, including retained picker focus and no phone overflow. Evidence includes
`rtl-smoke.json` and `rtl-create-orders-1440.png` / `rtl-create-orders-390.png`.
The shared preview's language click and snapshot timed out, so the RTL check used the same
isolated Playwright harness as the timing pass. No full test suite and no push.

### Conflict Recovery Recheck (M1-M9, 2026-11-05)

- M1: preserve legacy draft removals with unknown bases and read stored header bases.
- M2: save a clean or resolved merge with the current timestamp and ETag; clear the stale error.
- M3: compare adjustments as sorted reason/quantity pairs, excluding server row ids.
- M4: provide product/column labels, localized values, treatment months, Added/Removed,
  a dialog description, per-field radio groups and retry errors with the server message.
- M5: route Recover Edits through Sync's busy/session/authorization guards and read the latest
  draft after GET so edits typed during recovery survive.
- M6: track reconciliation per action so retries never reconcile twice.
- M7: use GET's approval baseline and retain Approve's outcome if the follow-up GET fails.
- M8: disable the client timeout for Delete, Initiate and Release too.
- M9: reserve the labelled Requesting Facility row in the pending Create Orders form.

Tests first reproduced lost removals, false adjustment conflicts, the stale conflict dialog,
recovery typing and masked Approve success. Focused tests also cover single reconciliation,
stored legacy header bases and resetting the server failure on retry.

### Create Orders Rendering Follow-Up (FM-49, 2026-11-05)

Production CPU samples and click timestamps isolate the remaining delay to navigation/page
mounting, before Program is clicked. The measured opening performs no API requests.

Move the sidebar's location subscription, rights-filtered navigation and accordion state into
its navigation subtree, and memoize the header and sidebar around their own subscriptions.
Route changes and section expansion no longer rerender the logo,
appearance/language controls and other footer actions. Disabled Create Orders fields render
an inactive input with the same label, selected value and dropdown affordance, mounting the
combobox only when it becomes usable. Enabled picker behavior is unchanged.

No full suite, push or server data writes were used. The production preview has an independent API mutation guard; only OAuth
and read-only searches are permitted as non-GET requests.

Evidence: `.screenshots/FM-39-m/orders-before-three.json` contains the production baseline,
and `orders-memo-final.json` contains the retained implementation's alternating new/legacy
runs with CPU profiles, click offsets and request waterfalls. Focused order/sidebar tests, TypeScript,
Biome, design-system lint and production builds pass.

Retained production round: before 208/214/175 ms (median 208), after 145/204/159 ms
(median 159), matched legacy 129/168/164 ms (median 164). Every opening had zero API
requests. These samples meet the median comparison in that round, but do not establish
consistent parity with the earlier 138 ms legacy reference. Later discarded experiments
were slower; do not describe the performance target as consistently achieved. The final
production rebuild matches all 27 JavaScript assets sampled in the retained CPU profiles.

Arabic production smoke checks pass at 1440 and 390 px with fully intercepted fixture APIs:
readable product/column labels, a described dialog, one radio group per field, no phone
horizontal overflow, and automatic resolution with GET's fresh ETag. Evidence:
`rtl-merge.json`, `merge-1440-ar.png` and `merge-390-ar.png` in the same evidence directory.

## Final Facility And List Revisions (F3-F5, 2026-11-05)

- F3 final removes View's fifty-result limit and match-count status, including its key in all
  five catalogs. A shared virtual list keeps visible options mounted, preserves keyboard
  navigation and exposes item positions and total size to assistive technology. Selected
  facilities reopen within the full list, marked and scrolled into view. Create Orders'
  requesting and supplying pickers also lose their cap; Create/Authorize was already uncapped.
- F4 retains online View and Approve results when the connection drops, matching legacy
  `requisition-search.controller.js`. Show their online load time and stale-data notice;
  disable View with Not Available Offline for rows without a copy. Search or changing the
  applied criteria offline switches to saved-copy results. Session changes reset the source.
- F5 keeps View visible on every row, with a separate trash Remove From This Device for copies.
  Cards use CardActions. Keep dirty-copy confirmation, revision checks, owner/session guards,
  batch-only navigation and cancellation focus restoration.

### Production Picker Evidence

An isolated Vite production build imports the real RequisitionSearchPicker and OrderSelect,
with 1,006 facilities. Its static server on port 5293 rejects API calls and all writes. Local
Chromium uses a fresh context per English/Arabic and 1440/390 px scenario, with no saved session.
Ten openings and forty input events per scenario measure from the real pointer/input event
through two animation frames. Every opening verifies the selected facility is marked, visible,
and part of all 1,006 options. Typing filters by code, and keyboard movement retains a mounted
active item. Evidence and the reproducible fixture are in `.screenshots/F3-F5/`.

The final View run measured the following event-to-paint times, including two animation frames:

| Language And Width | Open Median | Open Maximum | Typing Maximum |
|---|---:|---:|---:|
| en 1440 px | 48.6 ms | 112.8 ms | 32.3 ms |
| en 390 px | 58.5 ms | 111.5 ms | 30.7 ms |
| ar 1440 px | 58.4 ms | 126.2 ms | 35.5 ms |
| ar 390 px | 33.6 ms | 86.2 ms | 31.0 ms |

Every scenario mounted at most thirteen options. Openings were within or below the earlier
legacy opening range of roughly 90-230 ms; every typing sample stayed below 50 ms. The shared
preview's Arabic frame measurements timed out, so these final measurements use a separate local
Chromium process. The selected item and its visibility passed in all four scenarios. No server
data or shared preview was changed. Full application production build also passed.

Create Orders' shared requesting/supplying picker also passed all four language/width scenarios
with 1,006 facilities: 32.8-151.4 ms opening, 12.5-29.5 ms typing, and at most thirteen mounted
options. Its selected facility was marked and visible on every opening. Focused verification
passes 67 tests across the View/Approve routes, shared form fields and Create Orders. Final
checks: `pnpm sort-messages`, `pnpm tsc --noEmit`, `pnpm check`, and `pnpm lint:ds`.

### Screen QA Follow-Up

- F6: keep View and the saved-batch action separate offline, with complete row identity and independent readiness.
- F7: scroll the virtual facility picker to its selection on opening or selected-key changes, preserving manual scrolling when item references change.
- F8: if retained online results are evicted offline, read device results without an online request.
- Q1: invalidate affected lists without awaiting refetches before navigation. Batch copy capture does not delay mutation completion.
- Q2: recognize stored edits already accepted by the server before reporting an outdated draft; retire only matching values through the revision-checked writer.
- Q3: include comment-free status changes, dates and author lookups in history; reserve No Comments for comments and use No Status Changes for empty history.
- Q4: controlled paired measurements show no remaining regression against legacy in the requested approval steps.
- Q5: cold offline View derives facility/program choices and results from complete owned copies without requiring the separate requisition access download. Existing complete access snapshots still restrict exact View pairs.
- Q6: show a compact missing-filter note when copies are usable, preserving reconnect retry.
- Q7: membership timeouts settle into failed verification with Try Again, friendly wording and a disabled Approve label.
- Q8: offline batch Sync and Approve explain the connection requirement through aria-description.

Copy feedback follows the latest snapshot capture and opening. Older captures cannot hide a newer failure; approval persistence failures supersede pending capture callbacks. The current capture supplies the saving indicator.

#### Final Verification

- 116 focused tests passed across the six changed test files. The broader single/batch/approval/offline regression pass also passed 174 tests in five files. No full suite was run.
- Both cache-eviction tests fail with the old query functions and pass with the device fallback. The held-capture interaction reproduces the stale-success race before its guard.
- TypeScript, Biome, design-system lint and the production build pass. All five catalogs have matching, sorted keys.
- Cold offline View shows a complete saved copy with zero separate access snapshots, at 1440 px in English and 390 px in Arabic. Arabic uses RTL cards with separate View and removal actions.
- Evidence and controlled harness: `.screenshots/FM-39-r7/README.md`. Both origins stub every write except token requests and read-only POST searches; period reads never send unfinished=true. Real GET latency is retained; Q1 overlays the reserved record and period status consistently because mutations are stubbed.

Median seconds, settled / warm. Three runs per cell.

| Action | Before | After | Legacy |
|---|---:|---:|---:|
| Submit | 1.802 / 1.840 | 1.804 / 1.792 | 2.374 / 2.375 |
| Authorize | 1.806 / 1.816 | 1.798 / 1.788 | 2.506 / 2.286 |
| Single Approve | 2.087 / 2.084 | 2.075 / 2.087 | 4.514 / 4.465 |
| Two-Level Open | 1.012 / 0.319 | 0.655 / 0.328 | 5.276 / 4.835 |
| Level-1 Approve | 2.085 / 2.090 | 2.092 / 2.103 | 4.618 / 4.617 |
| Sync | 1.324 / 1.264 | 1.252 / 1.237 | 5.176 / 5.141 |
| Batch Sync | 1.622 / 1.591 | 1.566 / 1.554 | 1.820 / 1.834 |
| Batch Approve | 3.729 / 3.699 | 3.702 / 3.704 | 6.020 / 6.013 |

## Online Release Follow-Up (R8)

- RV8: Create Order stays disabled until every order in the batch has valid positive
  quantities and no loading/access problem. Its accessible description explains the requirement.
  Existing interaction coverage now verifies empty and invalid sibling orders before allowing creation.

- Q8b: offline batch Sync and Approve now have a visible connection note beside the footer
  actions, reusing the existing connection description and preserving their accessible descriptions.

- Q7b: timeout errors retain a translation key through the action state and resolve it during
  rendering, so an already-open failure message follows a language change.

- RV4/RV10: online editors show one device status. Background capture preparation or failure
  replaces the passive saved-draft badge; active draft persistence/errors retain priority.
  Background-copy copy explicitly concerns offline access and leaves server saves unaffected.
  Offline snapshot and draft recovery behavior is unchanged. All five catalogs are synchronized.

- RV9: conversion and release confirmations use the selected requisition count with ICU
  plurals and plain wording in all five catalogs.
- Q1b skipped: this optional optimistic list-status update is outside the confirmed defects.
  Existing nonblocking invalidation refreshes the authoritative status without delaying navigation;
  predicting Submit/Authorize status would add a second transition policy.

- RV2: the protected route's initial pending view renders the app shell and the destination's
  pending view instead of a second generic heading/body layout. Identity changes still hide
  the previous user's content behind the access skeleton.

- RV11: toast placement accounts for the visible workspace header as well as the app header,
  so desktop header actions remain reachable. The offset follows header resizing and scrolling
  while toasts are present; retained hidden pages do not affect it.
