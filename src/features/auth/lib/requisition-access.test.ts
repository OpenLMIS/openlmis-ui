import { describe, expect, it } from 'vitest';
import { canViewRequisitions } from '@/features/auth/lib/requisition-access';
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
