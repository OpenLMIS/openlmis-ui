# Offline Issue And Receive

Ticket to be created under [FM-164](https://openlmis.atlassian.net/browse/FM-164) Offline
support; rename this plan to its key. Builds on [FM-165](FM-165.md) and [FM-166](FM-166.md).
Legacy runs Issue and Receive offline; this brings both to the level of Adjustments.

## Scope

- Issue and Receive edit, autosave and submit offline for downloaded home-facility programs,
  queued through the existing device drafts, queue, uploader and Offline Events.
- Two PRs, each merged before the next starts: Issue first (with the shared download changes),
  then Receive.
- Not in scope: Unpack and Transaction History stay online-only, as legacy; Physical Inventory
  offline counting is a later FM-166 PR; supervised facilities stay online-only.

## Summary

Legacy downloads everything Issue and Receive need right after sign-in: where stock can go to
or come from, reasons, the facility's stock, products, lots and kit contents. Offline, Submit
reads Submit Offline, the event waits on the device and goes out in order when the connection
returns. Legacy then opens Stock On Hand and offers no print.

The new UI already does this for Adjustments. Issue needs one more downloaded list, the valid
destinations, and then uses the same download, draft, queue and recovery.

Receive offers every product the facility is approved for, not only products in stock, and can
add new lots. For Essential Meds that is 10,003 products, so Receive gets its own background
download that keeps only the fields the screen uses and, as legacy, is refreshed at each
sign-in rather than every 30 minutes. New lots typed offline go inside the queued event, as scanned lots
already do; the server creates them when the event arrives. Legacy cannot submit typed new lots
offline at all.

Both kinds skip the print offer when the event is only queued, and land on Stock On Hand for
that facility and program, as Adjustments does. As legacy, quantities are checked against the
downloaded balance only; events still waiting to sync do not reduce it.

## Acceptance Criteria

Drawn from FM-164 and the FM-166 criteria, applied to Issue and Receive.

| AC | How it is met | How it is checked |
|---|---|---|
| After one online visit, Issue and Receive open and work with the network off, also after a browser restart | Kind policy enables device drafts and datasets; counterparties and the Receive catalog download at sign-in | Browser: Issue restart then submit; Receive typed new lot queued |
| Never-downloaded data says so | Picker shows Downloading or Not Downloaded per program and kind, with the reason (no stock-card right, older download) | Unit: picker readiness per kind; one assertion in `downloads.spec.ts` |
| Saved On This Device, Synced only after acceptance | Shared draft store and submission | Existing coverage; the Issue browser submit |
| Reconnect sends queued events in order; refusals become sync errors | Shared uploader and recovery, kind-blind | Existing sync and retry specs |
| Expiry pauses sync; logout warns; no offline data in localStorage | Shared | Existing |
| Receiving many products does not fail with a storage error (FM-65) | Slim catalog in IndexedDB | Measurement on test, Essential Meds, recorded here |

## Legacy Today

Observed on test.openlmis.org as administrator, Comfort Health Clinic, Family Planning
(screenshots in `.screenshots/FM-166/`, gitignored).

- Sign-in downloads everything: products for all programs (about 10 MB), all lots, reasons, valid
  destinations and sources, fulfil mappings and unpaged stock summaries per home program
  (2.6 MB for Essential Meds). Opening the program list offline makes no calls.
- Offline, Issue and Receive lists and editors open with every control enabled; Unpack and
  Transaction History are greyed out. Submit reads Submit Offline.
- Confirmation is the usual signature dialog. After Confirm it opens Stock On Hand for that
  facility and program with a toast ("... submitted offline") and an offline banner. No print.
- The queue is localStorage `openlmis.stockEvents` per user, holding the exact body without a
  document number. Receive offers products with no stock card yet (29 against Issue's 17 on test).
- A typed new lot on Receive fails offline: legacy first sends `POST /api/lots`, then shows
  "This action can't be completed while offline." and queues nothing.

## Agent Brief

### API Map

| Step | Method and path | Params | Fields used | Right | Legacy ref |
|---|---|---|---|---|---|
| Destinations (Issue) | `GET /api/validDestinations` | `programId`, `facilityId` (home), `size=2147483647` as legacy; dedupe by id | `id`, `name`, `node.id`, `node.refDataFacility`, `isFreeTextAllowed` | Authenticated | `destination-cache.run.js:28-50` |
| Sources (Receive) | `GET /api/validSources` | same | same | Authenticated | `source-cache.run.js:28-50` |
| Stock, products of cards, reasons | Home-stock bundle, now format 6 | unchanged | unchanged | `STOCK_CARDS_VIEW` | `full-stock-card-summary-cache.run.js` |
| Receive catalog: approved set | `GET /api/v2/stockCardSummaries` | `facilityId`, `programId`, `nonEmptyOnly=false` (about 2.6 MB for Essential Meds) | `orderable.id`, `orderable.versionNumber`, `stockOnHand` | `STOCK_CARDS_VIEW` | legacy's unpaged summaries |
| Receive catalog: product details | `GET /api/orderables` | `program` code, kept for the approved ids and the products that fulfil them | `id`, `versionNumber`, `productCode`, `fullProductName`, `netContent`, `dispensable.displayUnit`, `identifiers.tradeItem`, `extraData.useVVM` | Authenticated | `orderable.run.js:28-43` |
| Receive fulfil mapping | `GET /api/orderableFulfills` | `facilityId` (home), `programId` | as `facilityOrderableFulfillsOptions` | Authenticated | `orderable-fulfills.run.js:28-51` |
| Receive lots | `GET /api/lots` | `tradeItemId` repeated, 100 per request, every page | `id`, `lotCode`, `expirationDate`, `tradeItemId`, `active` | Authenticated | legacy: one unfiltered call |
| Receive scan GTINs (`GS1_SCANNING` on) | `GET /api/tradeItems` by ids, as `fetchTradeItemsByIds` | catalog trade items | `id`, `gtin` | Authenticated | |
| Submit | `POST /api/stockEvents` | unchanged; typed or scanned new lots as `lot{lotCode, expirationDate}` without `lotId` | | `STOCK_ADJUST` | `adjustment-creation.service.js:79-164` |

No new endpoints. If the summaries plus orderables route proves slower or larger on test than
`approvedProducts`, the fallback is one unpaged `approvedProducts` request (18.6 MB) with a
longer timeout for this download only; its pages have no stable order, so it is never paged.

### Data and storage

- **Home stock, format 6:** adds the scope's valid destinations and sources (one record, one
  generation). The provider writes 6 and its freshness requires 6, so stored 5s refresh.
  `readHomeStockBundle` and Adjustments accept 4, 5 and 6; Stock On Hand accepts complete 5 and 6
  (format 4 has no summaries); Issue and Receive require 6. A device with only format 5 shows Issue and Receive as needing a download
  until it reconnects. No Dexie version in the Issue PR (no new index).
- **Receive catalog:** provider `receive-catalog`, Dexie version 12 table
  `receiveCatalogDownloads` keyed `[facilityId+programId]`, an owned record with `userId` and
  `formatVersion` through `local-records.ts`. Holds the approved ids with their versions, slim
  product snapshots, the fulfil mapping, slim lots and, with scanning, `{tradeItemId, gtin}`.
  Products cover the approved set plus every product in their `canFulfillForMe`, with those
  products' lots and GTINs, as the online picker offers. Complete generation or nothing: refuse
  when any approved product is missing.
  Scopes: `homeStockScopes` intersected with the Receive grant, with its own refresh key
  `receive-catalog:<facility>:<program>`. Registered in `-device-work-provider.tsx` with label
  key `offline.download.receive-catalog`.
- **Freshness:** home stock keeps 30 minutes. The catalog refreshes at sign-in only, as legacy:
  providers declare their refresh triggers, and the catalog skips periodic checks, reconnect and
  session resume (`force`) while it has a complete record for the current access. Accepted events
  never request the catalog: it has its own refresh key, `refreshAfterStockEventAccepted` keeps
  sending only the home-stock key.
- Receive stock on hand comes from the home-stock bundle; a catalog product with no summary
  reads as zero. A product in stock but missing from an older catalog is still offered, taken
  from the bundle.
- Reference-data fetchers used by downloads (`fetchValidAssignments`, `fetchFacilityOrderableFulfills`,
  `fetchLotsByTradeItems`, the summaries and orderables readers) take an optional request config so
  background downloads pass `signal`, `session: false` and the session scope.

### Code changes

- `event-kinds.ts`: Issue and Receive set `drafts: 'device'`; `download` becomes a list of
  datasets with acceptance (`home-stock` with a minimum format, `receive-catalog`).
- Program picker: read the kind's datasets through `useDownloadedScopes`, a fixed number of hook
  calls gated by `enabled`; replace the hardcoded provider and `acceptsAdjustmentBundle`.
  States: Downloading, Not Downloaded (with reason), Ready.
- Counterparties: bundle-backed read only for kinds with a download, as reasons do, keeping the
  server key online so admin saves still refresh; `eventPayload` maps counterparties to nodes
  from the same list.
- Receive picker and scanning (`ApprovedProductLotPicker`, `approvedScanProduct`): a device path
  that searches the catalog by name locally and pages it with the same Show More. The editor's
  first GTIN lookup goes through the catalog for Receive (home stock keeps it for Adjustments and
  Issue), and offline scans resolve within the catalog and the facility fulfil mapping only.
- `useDeviceDrafts` readiness and `refreshStockEventLines`: policy for approved-product kinds;
  keep typed and scanned new lots instead of replacing them with a missing card's lot.
- `useStockEventPrint`: skip the print dialog for an unsynced event; land on scoped Stock On Hand.
- Typed new lots offline: shown only with `LOTS_MANAGE` from saved access, hidden otherwise, as
  online; duplicate-code check, ignoring case, against downloaded lots and lots in queued events.

### Rules

- Quantity caps are unchanged: Issue always (`stockOnHandCap: 'always'`), Adjustments with a
  debit reason, both against the downloaded balance without subtracting queued events, as legacy.
  Overdrafts the device cannot see reach Offline Events as sync errors.
- Destination or source required; free text only where the assignment allows it.
- No `documentNumber` sent; the server generates one.
- Server lot creation needs a source and no destination; codes up to 20 GS1 characters
  (`lot-code.ts` already matches); expiry optional, `yyyy-MM-dd`.

### Tests

- Unit: format 4, 5 and 6 acceptance per kind, including Stock On Hand refusing 4 (one
  parameterized test); the download decision refreshes the catalog only at sign-in and never
  after accepted events; the catalog provider refuses incomplete generations and other owners;
  Dexie v11 to v12 keeps data; catalog search and paging, including zero stock for catalog-only products;
  picker readiness per kind; print skipped for a queued event; duplicate lot check covers queued
  events.
- Browser (stubs, POST blocked): Issue offline submit through a restart; Receive with a typed new
  lot queued inside the body. Missing catalog: one assertion in `downloads.spec.ts`. `stub()`
  gains destinations, sources, summaries without `nonEmptyOnly`, orderables, fulfils and lots;
  `enqueue` takes a kind.
- Measure on test with Essential Meds before Receive merges: catalog requests, time, transfer and
  stored size, recorded here.
- Walk Arabic and phone: Receive catalog search with Show More on cards, Downloading and Not
  Downloaded picker states.

### Risks

- The server matches a queued new lot by code only, ignoring expiry: if someone creates the same
  code after the download, the event uses the existing lot and its expiry without refusal.
- A lot created for an event the server then refuses stays created; resending reuses it.
- Catalog size on slow links at each sign-in; mitigated by background download that never
  blocks sign-in, and slim storage. Lot requests grow with trade items (one per 100).
- Product versions: queue the exact version shown; a newer catalog keeps existing draft lines on
  their version, and server refusals surface as sync errors.
- A destination removed on the server before sync is refused; Copy For Correction offers only
  current counterparties.

## UI/UX

- **Port:** Submit Offline, signature confirmation, no print offer offline, landing on Stock On
  Hand, offline notices, pending-work note, scanned new lots queued inside the event.
- **Improve:** typed new lots work offline (legacy fails); downloads never block sign-in; the
  picker says which programs are downloading or not downloaded, and why; Receive searches the full catalog instantly instead of a 30+ second load.
- **Drop:** none.
- States: Downloading, Not Downloaded with reason, download time on the editor's offline notice.
  Phone cards and Arabic unchanged from the online editors.

## Decisions

- Destinations and sources ride in home stock format 6; the catalog is a separate provider so its
  size never delays Adjustments, Issue or Stock On Hand.
- The catalog follows legacy's sources (summaries without `nonEmptyOnly`, orderables by program)
  rather than unstable paging of `approvedProducts`.
- Typed new lots queue inside the event (FM-167 decision, 2026-10-13).

## Answered Questions (2026-10-22)

1. Ticket: its own ticket under FM-164 (to be created; Jira was unreachable).
2. Catalog refresh: at each sign-in, as legacy.
3. Quantity checks: downloaded balance only, as legacy; queued events are not subtracted.
4. Offline Receive needs the stock-card viewing right, as legacy.

## Steps

1. Issue PR: request config on reference-data fetchers; provider refresh triggers (sign-in only
   for the catalog); home stock format 6 with counterparties and acceptance of
   4, 5 and 6; datasets list on kinds and picker readiness; counterparty device read; print skip
   and landing; Issue policy switch; tests and the
   Issue browser spec. Verify: format 6 accepted by Adjustments and Stock On Hand; offline Issue
   end to end in a headless browser.
2. Receive PR: Dexie v12 and the catalog provider; device picker, search and scanning;
   readiness and line refresh for approved products and new lots; typed new lots offline with
   duplicate checks; Receive policy switch; tests and the browser spec. Verify: measurement on
   test recorded; offline Receive with a typed new lot in a headless browser; rebase onto any
   other schema bump before merge.
