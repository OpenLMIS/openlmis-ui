import { RIGHTS } from '@/features/auth/lib/rights';
import type { LiveNavLink } from '@/lib/types';

/** The right a page asks for, or a list of which any one opens it, so the nav only offers pages the user can open. */
const NAV_RIGHTS: Partial<Record<NonNullable<LiveNavLink['to']>, string | readonly string[]>> = {
  '/administration/facilities': RIGHTS.facilitiesManage,
  '/administration/supply-lines': RIGHTS.supplyLinesManage,
  '/administration/geographic-zones': RIGHTS.geographicZonesManage,
  '/administration/supervisory-nodes': RIGHTS.supervisoryNodesManage,
  '/administration/supply-partners': RIGHTS.supplyPartnersManage,
  '/administration/facility-types': RIGHTS.facilitiesManage,
  '/administration/lots': RIGHTS.lotsManage,
  '/administration/products': [RIGHTS.orderablesManage, RIGHTS.facilityApprovedOrderablesManage],
  '/administration/users': RIGHTS.usersManage,
  '/administration/roles': RIGHTS.usersManage,
  '/administration/service-accounts': RIGHTS.serviceAccountsManage,
  '/administration/programs': RIGHTS.programsManage,
  '/administration/processing-schedules': RIGHTS.processingSchedulesManage,
  '/administration/ideal-stock-amounts': RIGHTS.systemIdealStockAmountsManage,
  '/administration/requisition-templates': RIGHTS.requisitionTemplatesManage,
  '/administration/reasons': RIGHTS.stockCardLineItemReasonsManage,
  '/administration/requisition-groups': RIGHTS.requisitionGroupsManage,
  '/administration/rejection-reason-categories': RIGHTS.usersManage,
  '/administration/rejection-reasons': RIGHTS.usersManage,
  '/administration/valid-destinations': RIGHTS.stockDestinationsManage,
  '/administration/valid-sources': RIGHTS.stockSourcesManage,
  '/stock-management/stock-on-hand': RIGHTS.stockCardsView,
  '/stock-management/transaction-history': RIGHTS.stockCardsView,
  '/stock-management/physical-inventory': RIGHTS.stockInventoriesEdit,
  '/offline-events': [],
};

export function registerNavRights(entries: typeof NAV_RIGHTS) {
  Object.assign(NAV_RIGHTS, entries);
}

export const navRightFor = (to: NonNullable<LiveNavLink['to']>) => NAV_RIGHTS[to];
