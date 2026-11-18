import { describe, expect, it } from 'vitest';
import { tourForRoute } from '@/features/onboarding/lib/tours';
import { LIVE_NAV_GROUPS } from '@/lib/config';

const CSV_PAGES = ['/administration/equipment-catalog', '/administration/ideal-stock-amounts'];

const administrationPages = LIVE_NAV_GROUPS.flatMap((group) => group.items)
  .flatMap((item) => ('items' in item ? item.items : [item]))
  .flatMap((link) => ('to' in link && link.to ? [link.to] : []))
  .filter((to) => to.startsWith('/administration/') && !CSV_PAGES.includes(to));

describe('tourForRoute', () => {
  it.each(administrationPages)('gives the Administration list %s a guide', (to) => {
    expect(tourForRoute(`/(protected)/_protected${to}`)).toBeDefined();
  });
});
