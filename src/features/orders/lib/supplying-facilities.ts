import { facilityGrants, hasProgramGrant, type Permissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';

export function commonNodeIds(nodes: readonly (readonly { id: string }[])[]) {
  if (!nodes.length) return [];
  return [...new Set(nodes[0].map((n) => n.id))].filter((id) =>
    nodes.every((list) => list.some((n) => n.id === id)),
  );
}
export function supplierIds(lines: readonly { supplyingFacility: { id: string } }[]) {
  return [...new Set(lines.map((line) => line.supplyingFacility.id))];
}
export function requestingFacilities<T extends { id: string; name: string }>(
  permissions: Permissions,
  facilities: readonly T[],
) {
  const ids = new Set(
    permissions.grants.filter((g) => g.right === RIGHTS.orderCreate).map((g) => g.facilityId),
  );
  return facilities.filter((f) => ids.has(f.id)).sort((a, b) => a.name.localeCompare(b.name));
}
export function canReadOrders(
  permissions: Permissions,
  programId: string,
  supplierId: string,
  facilityIds: readonly string[],
) {
  return (
    [RIGHTS.ordersView, RIGHTS.ordersEdit, RIGHTS.shipmentsView, RIGHTS.shipmentsEdit].some(
      (right) => facilityGrants(permissions, right).some((g) => g.facilityId === supplierId),
    ) ||
    (facilityIds.length > 0 &&
      facilityIds.every((id) =>
        [RIGHTS.podsView, RIGHTS.podsManage].some((right) =>
          hasProgramGrant(permissions, right, id, programId),
        ),
      ))
  );
}

export function viewOrderSuppliers<T extends { id: string; name: string }>(
  permissions: Permissions,
  facilities: readonly T[],
) {
  const orderIds = new Set(facilityGrants(permissions, RIGHTS.ordersView).map((g) => g.facilityId));
  const podIds = new Set(
    permissions.grants.filter((g) => g.right === RIGHTS.podsManage).map((g) => g.facilityId),
  );
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  return [
    ...facilities.filter((f) => orderIds.has(f.id)).sort(byName),
    ...facilities.filter((f) => podIds.has(f.id) && !orderIds.has(f.id)).sort(byName),
  ];
}

export function fulfillOrderSupplierIds(permissions: Permissions) {
  return [
    ...new Set(
      [RIGHTS.ordersView, RIGHTS.shipmentsView, RIGHTS.shipmentsEdit].flatMap((right) =>
        facilityGrants(permissions, right).map((g) => g.facilityId),
      ),
    ),
  ].sort();
}
export function viewOrderSupplierIds(permissions: Permissions) {
  return [
    ...new Set([
      ...facilityGrants(permissions, RIGHTS.ordersView).map((grant) => grant.facilityId),
      ...permissions.grants
        .filter((grant) => grant.right === RIGHTS.podsManage)
        .map((grant) => grant.facilityId),
    ]),
  ].sort();
}
