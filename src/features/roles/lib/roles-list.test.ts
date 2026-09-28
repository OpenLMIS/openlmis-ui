import { describe, expect, it } from 'vitest';
import type { Role } from '@/features/reference-data/lib/types';
import { filterRoles, sortRoles, withSavedRole } from '@/features/roles/lib/roles-list';

const role = (
  id: string,
  name: string,
  type: Role['rights'][number]['type'] | undefined,
  count = 0,
  description = '',
): Role => ({
  id,
  name,
  description,
  count,
  rights: type ? [{ id: `${id}-right`, name: 'SOME_RIGHT', type }] : [],
});

const roles = [
  role('1', 'Storeroom Manager', 'SUPERVISION', 4, 'Runs the depósito'),
  role('2', 'admin', 'GENERAL_ADMIN', 1),
  role('3', 'Warehouse Manager', 'ORDER_FULFILLMENT', 9),
  role('4', 'Empty', undefined, 0),
  role('5', 'Report Viewer', 'REPORTS', 2),
];

const names = (list: Role[]) => list.map((item) => item.name);

describe('filterRoles', () => {
  it('keeps every role with no filter', () => {
    expect(filterRoles(roles, {})).toHaveLength(5);
  });

  it('matches the name or description, ignoring case and accents', () => {
    expect(names(filterRoles(roles, { q: 'manager' }))).toEqual([
      'Storeroom Manager',
      'Warehouse Manager',
    ]);
    expect(names(filterRoles(roles, { q: 'DEPOSITO' }))).toEqual(['Storeroom Manager']);
  });

  it('narrows to one type', () => {
    expect(names(filterRoles(roles, { type: 'ORDER_FULFILLMENT' }))).toEqual(['Warehouse Manager']);
    expect(names(filterRoles(roles, { q: 'manager', type: 'SUPERVISION' }))).toEqual([
      'Storeroom Manager',
    ]);
  });
});

describe('sortRoles', () => {
  it('sorts by name ignoring case', () => {
    expect(names(sortRoles(roles, 'name', false))).toEqual([
      'admin',
      'Empty',
      'Report Viewer',
      'Storeroom Manager',
      'Warehouse Manager',
    ]);
  });

  it('sorts by type in the order the app lists types, with no type last', () => {
    expect(names(sortRoles(roles, 'type', false))).toEqual([
      'Storeroom Manager',
      'Warehouse Manager',
      'Report Viewer',
      'admin',
      'Empty',
    ]);
  });

  it('sorts by the number of users, descending when asked, then by name', () => {
    expect(names(sortRoles(roles, 'count', true)).slice(0, 2)).toEqual([
      'Warehouse Manager',
      'Storeroom Manager',
    ]);
    expect(
      names(sortRoles([role('a', 'B', 'REPORTS'), role('b', 'A', 'REPORTS')], 'count', false)),
    ).toEqual(['A', 'B']);
  });

  it('leaves the given list alone', () => {
    const copy = [...roles];
    sortRoles(roles, 'name', true);
    expect(roles).toEqual(copy);
  });
});

describe('withSavedRole', () => {
  it('replaces an edited role, keeping how many users hold it', () => {
    const saved = { ...role('3', 'Warehouse Lead', 'ORDER_FULFILLMENT'), count: undefined };
    const list = withSavedRole(roles, saved);

    expect(list.find((item) => item.id === '3')).toMatchObject({
      name: 'Warehouse Lead',
      count: 9,
    });
    expect(list).toHaveLength(5);
  });

  it('adds a new role, held by nobody yet', () => {
    const saved = { ...role('6', 'Clerk', 'REPORTS'), count: undefined };

    expect(withSavedRole(roles, saved).at(-1)).toMatchObject({ id: '6', count: 0 });
  });
});
