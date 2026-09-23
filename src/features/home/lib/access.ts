/** What the signed-in user's rights let the dashboard show; the route works it out from their rights. */
export type DashboardAccess = {
  approve: boolean;
  convert: boolean;
  orders: boolean;
  equipment: boolean;
  requisitions: boolean;
};

export function hasAnyWidget(access: DashboardAccess) {
  return Object.values(access).some(Boolean);
}
