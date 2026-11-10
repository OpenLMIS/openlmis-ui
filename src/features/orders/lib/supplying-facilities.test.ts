import { describe, expect, it } from 'vitest';
import {
  canReadOrders,
  commonNodeIds,
  fulfillOrderSupplierIds,
  requestingFacilities,
  supplierIds,
  viewOrderSupplierIds,
  viewOrderSuppliers,
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
      'REQUISITION_CREATE|c|p',
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
    expect(canReadOrders(parsePermissions(['PODS_VIEW|a|p']), 'p', 's', ['a', 'b'])).toBe(false);
    expect(canReadOrders(parsePermissions(['PODS_VIEW|a|q']), 'p', 's', ['a'])).toBe(false);
  });
});

const facilities = [
  { id: 'a', name: 'Zulu' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Alpha' },
  { id: 'd', name: 'Delta' },
];

it('orders View suppliers by grant group then name, deduplicating across programs', () => {
  const permissions = parsePermissions([
    'ORDERS_VIEW|a',
    'ORDERS_VIEW|b',
    'PODS_MANAGE|a|p',
    'PODS_MANAGE|c|p',
    'PODS_MANAGE|c|q',
    'ORDERS_VIEW|d|p',
    'PODS_MANAGE|d',
  ]);
  expect(viewOrderSuppliers(permissions, facilities).map((f) => f.id)).toEqual(['b', 'a', 'c']);
  expect(viewOrderSupplierIds(permissions)).toEqual(['a', 'b', 'c']);
});

it('offers Fulfill suppliers from all three facility rights only', () => {
  const permissions = parsePermissions([
    'ORDERS_VIEW|a',
    'SHIPMENTS_VIEW|b',
    'SHIPMENTS_EDIT|c',
    'SHIPMENTS_EDIT|a',
    'SHIPMENTS_EDIT|d|p',
    'ORDERS_EDIT|d',
  ]);
  expect(fulfillOrderSupplierIds(permissions)).toEqual(['a', 'b', 'c']);
});

it('offers no supplier ids without grants', () => {
  const permissions = parsePermissions(['ORDERS_VIEW', 'SHIPMENTS_EDIT']);
  expect(viewOrderSuppliers(permissions, facilities)).toEqual([]);
  expect(fulfillOrderSupplierIds(permissions)).toEqual([]);
  expect(viewOrderSupplierIds(permissions)).toEqual([]);
});

it('offers POD requesters from scoped POD grants in any program and suppliers from facility shipment grants', async () => {
  const { podRequestingFacilityIds, podSupplyingFacilityIds } = await import(
    '@/features/orders/lib/supplying-facilities'
  );
  const permissions = parsePermissions([
    'PODS_MANAGE|a|p',
    'PODS_VIEW|a|q',
    'PODS_VIEW|b|q',
    'PODS_VIEW|c',
    'SHIPMENTS_EDIT|s',
    'SHIPMENTS_VIEW|s',
    'SHIPMENTS_VIEW|t',
    'SHIPMENTS_EDIT|u|p',
    'ORDERS_VIEW|v',
  ]);
  expect(podRequestingFacilityIds(permissions)).toEqual(['a', 'b']);
  expect(podSupplyingFacilityIds(permissions)).toEqual(['s', 't']);
});
