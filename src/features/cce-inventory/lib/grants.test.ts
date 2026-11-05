import { expect, it } from 'vitest';
import { editableGrants } from '@/features/cce-inventory/lib/grants';
import { parsePermissions } from '@/lib/permissions';

it('offers only the pairs where the user can both edit and view the inventory', () => {
  const permissions = parsePermissions([
    'CCE_INVENTORY_EDIT|home|epi',
    'CCE_INVENTORY_VIEW|home|epi',
    'CCE_INVENTORY_EDIT|balaka|epi',
    'CCE_INVENTORY_EDIT|home|fp',
    'CCE_INVENTORY_VIEW|lurio|epi',
    'CCE_INVENTORY_EDIT|lurio|fp',
    'CCE_INVENTORY_VIEW|lurio|fp',
  ]);

  expect(editableGrants(permissions)).toEqual([
    { right: 'CCE_INVENTORY_EDIT', facilityId: 'home', programId: 'epi' },
    { right: 'CCE_INVENTORY_EDIT', facilityId: 'lurio', programId: 'fp' },
  ]);
});
