/** The rights the new UI checks; OpenLMIS has many more, this lists the ones a screen here asks about. */
export const RIGHTS = {
  requisitionView: 'REQUISITION_VIEW',
  requisitionApprove: 'REQUISITION_APPROVE',
  ordersEdit: 'ORDERS_EDIT',
  ordersView: 'ORDERS_VIEW',
  podsManage: 'PODS_MANAGE',
  cceInventoryView: 'CCE_INVENTORY_VIEW',
} as const;

export type Right = (typeof RIGHTS)[keyof typeof RIGHTS];

/** The right names a user holds anywhere; a permission string is `RIGHT`, `RIGHT|facility|program` or `RIGHT|facility`. */
export function toRights(permissionStrings: readonly string[]): ReadonlySet<string> {
  return new Set(permissionStrings.map((permission) => permission.split('|', 1)[0]));
}
