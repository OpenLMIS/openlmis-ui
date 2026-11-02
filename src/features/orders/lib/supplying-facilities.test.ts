import { describe, expect, it } from 'vitest';
import {
  canReadOrders,
  commonNodeIds,
  requestingFacilities,
  supplierIds,
} from '@/features/orders/lib/supplying-facilities';
import { parsePermissions } from '@/lib/permissions';

describe('order facility choices', () => {
  it('intersects nodes before deduplicating suppliers', () => {
    expect(
      commonNodeIds([
        [{ id: 'a' }, { id: 'b' }],
        [{ id: 'b' }, { id: 'c' }],
      ]),
    ).toEqual(['b']);
    expect(commonNodeIds([[{ id: 'a' }], [{ id: 'c' }]])).toEqual([]);
    expect(commonNodeIds([])).toEqual([]);
    expect(
      supplierIds([{ supplyingFacility: { id: 's' } }, { supplyingFacility: { id: 's' } }]),
    ).toEqual(['s']);
  });
  it('offers requesting facilities across programs once, sorted by name', () => {
    const permissions = parsePermissions([
      'ORDER_CREATE|a|p',
      'ORDER_CREATE|a|q',
      'ORDER_CREATE|b|q',
    ]);
    expect(
      requestingFacilities(permissions, [
        { id: 'a', name: 'Zulu' },
        { id: 'b', name: 'Alpha' },
        { id: 'c', name: 'Other' },
      ]).map((f) => f.id),
    ).toEqual(['b', 'a']);
  });
  it('requires supplier read access or POD access to every requesting pair', () => {
    expect(canReadOrders(parsePermissions(['ORDERS_VIEW|s']), 'p', 's', ['a', 'b'])).toBe(true);
    expect(
      canReadOrders(parsePermissions(['ORDERS_VIEW|other', 'ORDERS_VIEW']), 'p', 's', ['a']),
    ).toBe(false);
    expect(
      canReadOrders(parsePermissions(['PODS_VIEW|a|p', 'PODS_MANAGE|b|p']), 'p', 's', ['a', 'b']),
    ).toBe(true);
    expect(canReadOrders(parsePermissions(['PODS_VIEW|a|q']), 'p', 's', ['a'])).toBe(false);
  });
});
