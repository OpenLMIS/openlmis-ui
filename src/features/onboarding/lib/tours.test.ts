import { describe, expect, it } from 'vitest';
import { tourForRoute } from '@/features/onboarding/lib/tours';
import { isNavParent, LIVE_NAV_GROUPS } from '@/lib/config';

const navPages = LIVE_NAV_GROUPS.flatMap((group) => group.items)
  .flatMap((item) => (isNavParent(item) ? item.items : [item]))
  .flatMap((link) => (link.to ? [link.to] : []));

const guidedPages = [
  ...navPages.filter(
    (to) =>
      to.startsWith('/administration/') ||
      to.startsWith('/requisitions/') ||
      to.startsWith('/orders/'),
  ),
  '/requisitions/approve_/batch',
  '/requisitions/create-orders_/$orderIds',
  '/orders/fulfillment_/$orderId',
  '/orders/proof-of-delivery_/$podId',
  '/administration/facilities_/new',
  '/administration/facilities_/$id',
  '/administration/products_/$id/general',
  '/administration/products_/$id/programs',
  '/administration/products_/$id/facility-types',
  '/administration/products_/$id/kit-unpack-list',
  '/administration/requisition-templates_/$id',
  '/administration/users_/$id/roles',
  '/administration/reasons_/new',
  '/administration/reasons_/$id',
  '/administration/requisition-groups_/new',
  '/administration/requisition-groups_/$id',
  '/administration/requisition-groups_/$id_/edit',
  '/administration/supervisory-nodes_/$id',
  '/administration/supply-partners_/$id',
];

describe('tourForRoute', () => {
  it.each(guidedPages)('gives %s a guide', (to) => {
    expect(tourForRoute(`/(protected)/_protected${to}`)).toBeDefined();
  });
});
