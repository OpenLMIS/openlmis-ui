import { describe, expect, it } from 'vitest';
import { hasProgramGrant, parsePermissions, programGrants } from '@/lib/permissions';

describe('parsePermissions', () => {
  it('names every right the user holds, scoped or not', () => {
    const { rights } = parsePermissions([
      'USERS_MANAGE',
      'STOCK_CARDS_VIEW|f1|p1',
      'PODS_MANAGE|w1',
    ]);

    expect([...rights]).toEqual(['USERS_MANAGE', 'STOCK_CARDS_VIEW', 'PODS_MANAGE']);
  });

  it('keeps a facility and program grant once, and nothing malformed', () => {
    const { grants } = parsePermissions([
      'STOCK_CARDS_VIEW|f1|p1',
      'STOCK_CARDS_VIEW|f1|p1',
      'STOCK_CARDS_VIEW|f2|',
      'STOCK_CARDS_VIEW||p1',
      'STOCK_CARDS_VIEW|f1|p1|x',
      '|f1|p1',
      'STOCK_CARDS_VIEW',
      'PODS_MANAGE|w1',
    ]);

    expect(grants).toEqual([{ right: 'STOCK_CARDS_VIEW', facilityId: 'f1', programId: 'p1' }]);
  });

  it('leaves a blank string out of the right names', () => {
    expect([...parsePermissions(['', 'USERS_MANAGE']).rights]).toEqual(['USERS_MANAGE']);
  });
});

describe('hasProgramGrant', () => {
  const permissions = parsePermissions([
    'STOCK_CARDS_VIEW|f1|p1',
    'STOCK_ADJUST|f2|p2',
    'STOCK_CARDS_VIEW',
  ]);

  it('matches only the exact right, facility and program', () => {
    expect(hasProgramGrant(permissions, 'STOCK_CARDS_VIEW', 'f1', 'p1')).toBe(true);
    expect(hasProgramGrant(permissions, 'STOCK_CARDS_VIEW', 'f1', 'p2')).toBe(false);
    expect(hasProgramGrant(permissions, 'STOCK_CARDS_VIEW', 'f2', 'p2')).toBe(false);
  });

  it('never reads an unscoped right as a grant everywhere', () => {
    expect(hasProgramGrant(permissions, 'STOCK_CARDS_VIEW', 'f9', 'p9')).toBe(false);
  });
});

describe('programGrants', () => {
  it('lists the grants of one right only', () => {
    const permissions = parsePermissions(['STOCK_CARDS_VIEW|f1|p1', 'STOCK_ADJUST|f2|p2']);

    expect(programGrants(permissions, 'STOCK_CARDS_VIEW')).toEqual([
      { right: 'STOCK_CARDS_VIEW', facilityId: 'f1', programId: 'p1' },
    ]);
  });
});
