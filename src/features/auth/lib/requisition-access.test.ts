import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { permissionsOptions } from '@/features/auth/api/queries';
import { ForbiddenError } from '@/features/auth/lib/access';
import {
  canViewRequisitions,
  requireRequisitionView,
} from '@/features/auth/lib/requisition-access';
import { useLoginData } from '@/features/auth/store/login-data';
import { rolesOptions, userRecordOptions } from '@/features/reference-data/api/queries';
import type { Role } from '@/features/reference-data/lib/types';
import { parsePermissions } from '@/lib/permissions';

const roles = [{ id: 'viewer', rights: [{ name: 'REQUISITION_VIEW' }] }] as Role[];

describe('canViewRequisitions', () => {
  it('accepts a facility grant without a supervision role', () => {
    expect(
      canViewRequisitions(
        parsePermissions(['REQUISITION_VIEW|f|p']),
        { roleAssignments: [] },
        roles,
      ),
    ).toBe(true);
  });
  it('accepts a VIEW supervision role without permission strings', () => {
    expect(
      canViewRequisitions(
        parsePermissions([]),
        { roleAssignments: [{ roleId: 'viewer', supervisoryNodeId: 'partner' }] },
        roles,
      ),
    ).toBe(true);
  });
  it('refuses unassigned roles and non-supervision assignments', () => {
    for (const roleAssignments of [
      [],
      [{ roleId: 'viewer' }],
      [{ roleId: 'other', supervisoryNodeId: 'node' }],
    ]) {
      expect(
        canViewRequisitions(
          parsePermissions(['REQUISITION_CREATE|f|p']),
          { roleAssignments },
          roles,
        ),
      ).toBe(false);
    }
  });
});

it('rejects a direct route load without a facility or assigned supervision VIEW grant', async () => {
  const previous = useLoginData.getState().referenceDataUserId;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useLoginData.setState({ referenceDataUserId: 'audit-user' });
  client.setQueryData(permissionsOptions('audit-user').queryKey, parsePermissions([]));
  client.setQueryData(userRecordOptions('audit-user').queryKey, {
    id: 'audit-user',
    username: 'audit',
    firstName: 'Audit',
    lastName: 'User',
    active: true,
    roleAssignments: [],
  });
  client.setQueryData(rolesOptions().queryKey, roles);
  try {
    await expect(requireRequisitionView(client)).rejects.toBeInstanceOf(ForbiddenError);
  } finally {
    client.clear();
    useLoginData.setState({ referenceDataUserId: previous });
  }
});
