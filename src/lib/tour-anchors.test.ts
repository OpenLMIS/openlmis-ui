import { expect, it } from 'vitest';
import dataTable from '@/components/data-table/data-table.tsx?raw';
import filters from '@/components/data-table/data-table-filters-popover.tsx?raw';
import search from '@/components/data-table/data-table-search.tsx?raw';
import selection from '@/components/data-table/data-table-selection.tsx?raw';
import viewOptions from '@/components/data-table/data-table-view-options.tsx?raw';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

// The data-table folder imports no app code, so it spells these anchors out; tours depend on them.
it.each([
  [TOUR_ANCHORS.listFilters, filters],
  [TOUR_ANCHORS.listSearch, search],
  [TOUR_ANCHORS.listSelect, selection],
  [TOUR_ANCHORS.listSort, dataTable],
  [TOUR_ANCHORS.listTable, dataTable],
  [TOUR_ANCHORS.listView, viewOptions],
])('the data table still sets the %s anchor tours point at', (anchor, source) => {
  expect(source).toMatch(new RegExp(`['"]${anchor}['"]`));
});
