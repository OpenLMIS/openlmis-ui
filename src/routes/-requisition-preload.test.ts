import { QueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { permissionsOptions } from '@/features/auth/api/queries';
import { userRecordOptions } from '@/features/reference-data/api/queries';
import { parsePermissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import { hasRequisitionReferences } from '@/routes/-requisition-preload';

it.each([
  [RIGHTS.orderCreate, true],
  [RIGHTS.ordersView, false],
])(
  'warms requisition navigation for %s only when its pages are accessible',
  async (right, eligible) => {
    const client = new QueryClient();
    client.setQueryData(permissionsOptions('user').queryKey, parsePermissions([right]));
    client.setQueryData(userRecordOptions('user').queryKey, {
      id: 'user',
      username: 'user',
      firstName: 'Test',
      lastName: 'User',
      active: true,
      roleAssignments: [],
    });
    expect(await hasRequisitionReferences(client, 'user')).toBe(eligible);
    client.clear();
  },
);
