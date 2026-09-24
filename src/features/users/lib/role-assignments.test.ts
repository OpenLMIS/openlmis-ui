import { describe, expect, it } from 'vitest';
import type { Role } from '@/features/reference-data/lib/types';
import {
  assignmentKey,
  assignmentType,
  compareRows,
  countByType,
  countChanges,
  filterRows,
  mergeAssignments,
  type RoleLookups,
  rebaseDraft,
  rightLabel,
  toRoleRows,
  toSavedAssignment,
} from '@/features/users/lib/role-assignments';

const role = (id: string, name: string, type: Role['rights'][number]['type']): Role => ({
  id,
  name,
  rights: [{ id: `${id}-right`, name: 'SOME_RIGHT', type }],
});

const roles = new Map(
  [
    role('approver', 'Approver', 'SUPERVISION'),
    role('clerk', 'Clerk', 'SUPERVISION'),
    role('warehouse', 'Warehouse Clerk', 'ORDER_FULFILLMENT'),
    role('admin', 'Admin', 'GENERAL_ADMIN'),
  ].map((item) => [item.id, item]),
);

const lookups: RoleLookups = {
  roles,
  programs: new Map([['fp', { id: 'fp', code: 'PRG1', name: 'Family Planning', active: true }]]),
  nodes: new Map([
    ['sn1', { id: 'sn1', code: 'SN1', name: 'FP Approval Point', facility: { id: 'f1' } }],
  ]),
  facilities: new Map([
    ['f1', { id: 'f1', code: 'HC01', name: 'Comfort Health Clinic', active: true }],
    ['f2', { id: 'f2', code: 'W01', name: 'Ntcheu Warehouse', active: true }],
  ]),
};

const atNode = { roleId: 'approver', programId: 'fp', supervisoryNodeId: 'sn1' };
const atHome = { roleId: 'clerk', programId: 'fp' };
const atWarehouse = { roleId: 'warehouse', warehouseId: 'f2' };
const direct = { roleId: 'admin' };

describe('assignmentKey', () => {
  it('treats a missing id and a null one as the same', () => {
    expect(assignmentKey({ roleId: 'clerk', programId: 'fp', supervisoryNodeId: null })).toBe(
      assignmentKey(atHome),
    );
  });

  it('tells a home facility role from the same role at a node', () => {
    expect(assignmentKey({ ...atHome, supervisoryNodeId: 'sn1' })).not.toBe(assignmentKey(atHome));
  });
});

describe('toSavedAssignment', () => {
  it('keeps only the ids that are set', () => {
    expect(
      toSavedAssignment({
        roleId: 'clerk',
        programId: 'fp',
        supervisoryNodeId: null,
        warehouseId: '',
      }),
    ).toEqual({ roleId: 'clerk', programId: 'fp' });
  });
});

describe('assignmentType', () => {
  it("reads the role's type", () => {
    expect(assignmentType(atWarehouse, roles)).toBe('ORDER_FULFILLMENT');
  });

  it('falls back on the ids when the role no longer exists', () => {
    expect(assignmentType({ roleId: 'gone', programId: 'fp' }, roles)).toBe('SUPERVISION');
    expect(assignmentType({ roleId: 'gone', warehouseId: 'f2' }, roles)).toBe('ORDER_FULFILLMENT');
    expect(assignmentType({ roleId: 'gone' }, roles)).toBe('GENERAL_ADMIN');
  });
});

describe('mergeAssignments', () => {
  it('adds what is new and skips what is already held', () => {
    const result = mergeAssignments([atNode, direct], [atNode, atHome, atHome]);
    expect(result.assignments).toEqual([atNode, direct, atHome]);
    expect(result).toMatchObject({ added: 1, skipped: 2 });
  });
});

describe('rebaseDraft', () => {
  it('keeps what changed after the save was sent', () => {
    const sent = [atNode, direct];
    // During the save the user added one role and removed another.
    const draft = [atNode, atHome];
    expect(rebaseDraft(sent, [atNode, direct], draft)).toEqual([atNode, atHome]);
  });

  it('is the saved roles when nothing changed meanwhile', () => {
    expect(rebaseDraft([atNode], [atNode], [atNode])).toEqual([atNode]);
  });
});

describe('countChanges', () => {
  it('counts additions and removals, ignoring order', () => {
    expect(countChanges([atNode, direct], [direct, atNode])).toBe(0);
    expect(countChanges([atNode, direct], [direct, atHome])).toBe(2);
  });
});

describe('countByType', () => {
  it('counts each tab', () => {
    expect(countByType([atNode, atHome, atWarehouse, direct], roles)).toEqual({
      SUPERVISION: 2,
      ORDER_FULFILLMENT: 1,
      REPORTS: 0,
      GENERAL_ADMIN: 1,
    });
  });
});

describe('toRoleRows', () => {
  const context = { lookups, savedKeys: new Set([assignmentKey(atNode)]), homeFacilityId: 'f1' };

  it("lists one type's assignments with their names, by role", () => {
    const rows = toRoleRows([atHome, atNode, atWarehouse, direct], 'SUPERVISION', context);
    expect(rows.map((row) => row.role)).toEqual(['Approver', 'Clerk']);
    expect(rows[0]).toMatchObject({
      program: 'Family Planning',
      node: 'FP Approval Point',
      nodeFacility: 'Comfort Health Clinic',
      isUnsaved: false,
    });
  });

  it('shows the home facility for a role without a node', () => {
    const [row] = toRoleRows([atHome], 'SUPERVISION', context);
    expect(row).toMatchObject({
      isHomeFacility: true,
      nodeFacility: 'Comfort Health Clinic',
      isIgnored: false,
      isUnsaved: true,
    });
  });

  it('flags a home facility role as ignored when the user has no home facility', () => {
    const [row] = toRoleRows([atHome], 'SUPERVISION', { ...context, homeFacilityId: null });
    expect(row?.isIgnored).toBe(true);
  });

  it('leaves unknown or still loading names undefined instead of failing', () => {
    const [row] = toRoleRows(
      [{ roleId: 'approver', programId: 'gone', supervisoryNodeId: 'sn1' }],
      'SUPERVISION',
      { ...context, lookups: { ...lookups, nodes: undefined } },
    );
    expect(row).toMatchObject({ role: 'Approver', program: undefined, node: undefined });
  });

  it('names the facility of a fulfillment role', () => {
    const [row] = toRoleRows([atWarehouse], 'ORDER_FULFILLMENT', context);
    expect(row?.facility).toBe('Ntcheu Warehouse');
  });
});

describe('filterRows and compareRows', () => {
  const rows = toRoleRows([atHome, atNode], 'SUPERVISION', {
    lookups,
    savedKeys: new Set(),
    homeFacilityId: 'f1',
  });

  it('matches any shown name, ignoring case', () => {
    expect(filterRows(rows, 'approval').map((row) => row.role)).toEqual(['Approver']);
    expect(filterRows(rows, '  ')).toHaveLength(2);
    expect(filterRows(rows, 'COMFÓRT').map((row) => row.role)).toEqual(['Approver', 'Clerk']);
  });

  it('sorts by the chosen field, either way', () => {
    expect([...rows].sort(compareRows('role', true)).map((row) => row.role)).toEqual([
      'Clerk',
      'Approver',
    ]);
  });
});

describe('rightLabel', () => {
  it('turns a right code into words', () => {
    expect(rightLabel('REQUISITION_VIEW')).toBe('Requisition View');
    expect(rightLabel('APPROVE_BUQ')).toBe('Approve BUQ');
    expect(rightLabel('PODS_MANAGE')).toBe('PODs Manage');
  });
});
