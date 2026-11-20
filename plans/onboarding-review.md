# Onboarding Tours: Full Review Fixes

No ticket. Follow-up to a full-code review of the FM-199 tours (module, all tours, every anchor, all
`onboarding.*` copy) after FM-211. Stacked on FM-211.

## Scope

- **In:** confirmed findings 1 to 19 and the clean-ups the user approved (2026-11-20).
- **Out:** explaining more parts (template Columns grid, requisition Print, Delete, Skip, comments,
  Home Add User, Physical Inventory scanning): product calls for a later ticket. History entries from
  tab switches; `aria-busy` on the Approve toolbar fallback.

## Changes

- **Runner and launcher:** tooltip owns focus (Joyride's trap returned it to Show Guide between steps);
  Escape or Show Guide cancels a guide still waiting; a page with nothing to show says so in a toast
  and leaves focus alone; tab following clears once the tab is selected; a failed runner chunk is
  reported and retried on the next click.
- **One rule for disabled controls:** no anchor while disabled (stock event Clear, Submit and picker,
  Print, Reverse, Physical Inventory Delete and Save, requisition and batch footers, Create Orders
  supplier and Create, editor Save, the select-page checkbox).
- **States:** program steps skip the no-home-facility and no-programs card; Physical Inventory status
  cells are busy while they load; a single requisition tab plays no tabs step.
- **Copy:** order draft tabs mark, requisition tabs, grid toolbar, Administration View, Not On Device,
  Stock Card View, no pager mentions, labels in fr, pt, es and ar; Configure joins the actions legend;
  the template list's Actions header uses `data-table.actions`; pt `geographic-zones.actions` fixed.
- **Placement:** View Requisitions results and the requisition grid hang from the control above.
- **Clean-ups:** 16 page anchors that duplicated the shared `list-filters`, `list-view` and
  `list-search` removed; shared `ON_LIST`, `adminViewStep`, `sortStep` and `viewMenuStep` replace
  copies and their duplicate keys; a test ties the `list-*` strings in `data-table/` to `TOUR_ANCHORS`.

## Notes

- Home's BUQ step plays once the stack is rebased on master, where BUQ pages are live.
- Unit and picker keys repeated across stock tours were kept: those screens may word them apart.

## Checks

- Tests for focus between steps, cancelling a waiting guide, the unavailable toast and leaving after a
  local tab switch fail on the old code and pass now; touched areas 3325 tests pass.
- Browser smoke at 1440: Requisition Templates, View Requisitions, Issue, Physical Inventory, Stock On
  Hand, Transaction History, Create Orders, Home.
