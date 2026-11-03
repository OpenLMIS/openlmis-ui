import { describe, expect, it } from 'vitest';
import { type InventorySearch, inventorySavedSearch } from '@/features/cce-inventory/lib/search';
import type { CompleteSelection } from '@/lib/facility-program-selection';

const listSearch: InventorySearch = {
  mode: 'my',
  programId: 'epi',
  facilityId: 'home',
  page: 3,
  size: 25,
  sort: 'type',
  dir: 'desc',
  functionalStatus: 'FUNCTIONING',
  item: 'new',
};

const home: CompleteSelection = { mode: 'my', programId: 'epi', facilityId: 'home' };
const lurio: CompleteSelection = { mode: 'supervised', programId: 'fp', facilityId: 'lurio' };

describe('inventorySavedSearch', () => {
  it('shows the saved equipment: its pair, the first page, sort and size kept', () => {
    expect(inventorySavedSearch(listSearch, lurio, 'FUNCTIONING')).toEqual({
      ...lurio,
      size: 25,
      sort: 'type',
      dir: 'desc',
      functionalStatus: 'FUNCTIONING',
    });
  });

  it('drops a status filter that would hide the saved equipment', () => {
    expect(inventorySavedSearch(listSearch, home, 'AWAITING_REPAIR')).not.toHaveProperty(
      'functionalStatus',
    );
  });

  it('opens the list on the pair when the page was not opened from the list', () => {
    expect(inventorySavedSearch(undefined, lurio, 'FUNCTIONING')).toEqual(lurio);
  });
});
