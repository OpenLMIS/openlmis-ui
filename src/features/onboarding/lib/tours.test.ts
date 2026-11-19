import { describe, expect, it } from 'vitest';
import { tourForRoute } from '@/features/onboarding/lib/tours';
import { isNavParent, LIVE_NAV_GROUPS } from '@/lib/config';

const CSV_PAGES = ['/administration/equipment-catalog', '/administration/ideal-stock-amounts'];

const navPages = LIVE_NAV_GROUPS.flatMap((group) => group.items)
  .flatMap((item) => (isNavParent(item) ? item.items : [item]))
  .flatMap((link) => (link.to ? [link.to] : []));

const guidedPages = [
  ...navPages.filter(
    (to) =>
      (to.startsWith('/administration/') && !CSV_PAGES.includes(to)) ||
      to.startsWith('/requisitions/') ||
      to.startsWith('/orders/'),
  ),
  '/requisitions/approve_/batch',
  '/requisitions/create-orders_/$orderIds',
  '/orders/fulfillment_/$orderId',
  '/orders/proof-of-delivery_/$podId',
];

describe('tourForRoute', () => {
  it.each(guidedPages)('gives %s a guide', (to) => {
    expect(tourForRoute(`/(protected)/_protected${to}`)).toBeDefined();
  });
});
