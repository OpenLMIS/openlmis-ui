/** The rights the new UI checks; OpenLMIS has many more, this lists the ones a screen here asks about. */
export const RIGHTS = {
  requisitionView: 'REQUISITION_VIEW',
  requisitionApprove: 'REQUISITION_APPROVE',
  ordersEdit: 'ORDERS_EDIT',
  ordersView: 'ORDERS_VIEW',
  podsManage: 'PODS_MANAGE',
  cceInventoryView: 'CCE_INVENTORY_VIEW',
  facilitiesManage: 'FACILITIES_MANAGE',
  programsManage: 'PROGRAMS_MANAGE',
  usersManage: 'USERS_MANAGE',
  userRolesManage: 'USER_ROLES_MANAGE',
  rightsView: 'RIGHTS_VIEW',
  serviceAccountsManage: 'SERVICE_ACCOUNTS_MANAGE',
  systemSettingsManage: 'SYSTEM_SETTINGS_MANAGE',
  orderablesManage: 'ORDERABLES_MANAGE',
  facilityApprovedOrderablesManage: 'FACILITY_APPROVED_ORDERABLES_MANAGE',
  stockDestinationsManage: 'STOCK_DESTINATIONS_MANAGE',
  stockSourcesManage: 'STOCK_SOURCES_MANAGE',
  stockOrganizationsManage: 'STOCK_ORGANIZATIONS_MANAGE',
  stockCardLineItemReasonsManage: 'STOCK_CARD_LINE_ITEM_REASONS_MANAGE',
  lotsManage: 'LOTS_MANAGE',
} as const;

/** The right names a user holds anywhere; a permission string is `RIGHT`, `RIGHT|facility|program` or `RIGHT|facility`. */
export function toRights(permissionStrings: readonly string[]): ReadonlySet<string> {
  return new Set(permissionStrings.map((permission) => permission.split('|', 1)[0]));
}
