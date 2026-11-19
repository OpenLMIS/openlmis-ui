import { expect, it } from 'vitest';
import { canOpen, navWithinRights } from '@/components/app-shell/nav-access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { router } from '@/integrations/tanstack-router';
import { isNavParent, LIVE_NAV_GROUPS } from '@/lib/config';
import { routeRights } from '@/lib/route-rights';
import type { LiveNavGroup } from '@/lib/types';

const openRoutes = new Set([
  '/home',
  '/profile',
  '/profile/',
  '/profile/roles',
  '/profile/notifications',
]);
const redirects = new Set([
  '/administration/rejection-reason-categories/$id',
  '/administration/rejection-reasons/$id',
]);
const { routesById, routesByPath } = router;
const getRoute = (to: string) => routesByPath[to as keyof typeof routesByPath];
const rightsFor = (to: string) => routeRights(getRoute(to));
const links = (groups: LiveNavGroup[]) =>
  groups.flatMap((group) =>
    group.items.flatMap((item) => (isNavParent(item) ? item.items : [item])),
  );

it('declares or inherits opening rights for every gated page', () => {
  const protectedRoutes = Object.values(routesById).filter((route) =>
    route.id.startsWith('/(protected)/_protected/'),
  );
  for (const route of protectedRoutes) {
    if (openRoutes.has(route.fullPath)) {
      expect(routeRights(route), route.id).toBeUndefined();
    } else if (redirects.has(route.fullPath)) {
      expect(route.options.beforeLoad, route.id).toBeTypeOf('function');
      expect(route.options.component, route.id).toBeUndefined();
    } else {
      expect(routeRights(route), route.id).toBeDefined();
    }
  }
});

it('resolves live menu links and account links to routes', () => {
  for (const to of [...links(LIVE_NAV_GROUPS).map((link) => link.to), '/profile', '/settings']) {
    expect(to && getRoute(to), to).toBeDefined();
    if (to && !openRoutes.has(to)) expect(rightsFor(to)?.length ?? 0, to).toBeGreaterThan(0);
  }
  expect(getRoute('/settings').fullPath).toBe('/settings/');
  expect(getRoute('/settings').options.staticData?.rights).toBeUndefined();
  expect(rightsFor('/settings')).toEqual([RIGHTS.systemSettingsManage]);
});

it('filters the real menu and account links for no rights, some rights and all rights', () => {
  const visible = (rights: ReadonlySet<string>) =>
    links(
      navWithinRights(LIVE_NAV_GROUPS, rights, rightsFor, false, false, {
        SHOW_REQUISITION_LESS_ORDER: true,
      }),
    ).map((link) => link.to);

  const none = new Set<string>();
  expect(visible(none)).toEqual(['/home']);
  expect(canOpen('/profile', none, rightsFor)).toBe(true);
  expect(canOpen('/settings', none, rightsFor)).toBe(false);

  const some = new Set([RIGHTS.usersManage, RIGHTS.facilityApprovedOrderablesManage]);
  expect(visible(some)).toEqual(
    expect.arrayContaining([
      '/home',
      '/administration/users',
      '/administration/roles',
      '/administration/products',
    ]),
  );
  expect(visible(some)).not.toContain('/administration/programs');
  expect(canOpen('/settings', some, rightsFor)).toBe(false);

  const all = new Set(Object.values(RIGHTS));
  expect(visible(all)).toEqual(links(LIVE_NAV_GROUPS).map((link) => link.to));
  expect(canOpen('/settings', all, rightsFor)).toBe(true);
});

it('checks route rights in each route that declares them', () => {
  const sources = import.meta.glob<string>('/src/routes/(protected)/_protected.*.tsx', {
    eager: true,
    query: '?raw',
    import: 'default',
  });
  const guard =
    /\b(?:requireRouteRights|loadStockEventPrograms|loadStockEventEditor|stockCardAccess|loadBuqAccess|loadApproveAccess|loadNationalAccess|loadNationalForecast)\(/;
  const customGuards = new Set([
    '/(protected)/_protected/requisitions/view',
    '/(protected)/_protected/requisitions/view_/$requisitionId',
  ]);
  const missing = Object.entries(sources).flatMap(([path, source]) => {
    const id = source.match(/createFileRoute\(\s*'([^']+)'/)?.[1];
    const route = id && routesById[id as keyof typeof routesById];
    const declares = route && route.options.staticData?.rights !== undefined;
    const usesInlineRights = /\b(?:requireRight|requirePermissions)\(/.test(source);
    return usesInlineRights || (declares && !customGuards.has(id) && !guard.test(source))
      ? [path]
      : [];
  });
  expect(missing).toEqual([]);
});

it.each([
  ['/administration/service-accounts', [RIGHTS.serviceAccountsManage], RIGHTS.usersManage],
  ['/administration/facility-types', [RIGHTS.facilitiesManage], RIGHTS.usersManage],
  ['/administration/facilities', [RIGHTS.facilitiesManage], RIGHTS.usersManage],
  ['/administration/programs', [RIGHTS.programsManage], RIGHTS.requisitionTemplatesManage],
  ['/administration/roles', [RIGHTS.usersManage], RIGHTS.userRolesManage],
  [
    '/administration/products',
    [RIGHTS.orderablesManage, RIGHTS.facilityApprovedOrderablesManage],
    RIGHTS.usersManage,
  ],
  ['/buq/create', [RIGHTS.createForecasting, RIGHTS.authorizeForecasting], RIGHTS.prepareBuq],
  [
    '/administration/valid-destinations',
    [RIGHTS.stockDestinationsManage],
    RIGHTS.stockSourcesManage,
  ],
  ['/administration/valid-sources', [RIGHTS.stockSourcesManage], RIGHTS.stockDestinationsManage],
  ['/administration/reasons', [RIGHTS.stockCardLineItemReasonsManage], RIGHTS.stockAdjust],
  ['/administration/lots', [RIGHTS.lotsManage], RIGHTS.orderablesManage],
  ['/reports', [RIGHTS.reportsView], RIGHTS.usersManage],
  ['/stock-management/adjustments', [RIGHTS.stockAdjust], RIGHTS.stockCardsView],
  ['/stock-management/issue', [RIGHTS.stockAdjust], RIGHTS.stockCardsView],
  ['/stock-management/unpack', [RIGHTS.stockAdjust], RIGHTS.stockCardsView],
  ['/stock-management/physical-inventory', [RIGHTS.stockInventoriesEdit], RIGHTS.stockCardsView],
  [
    '/orders/fulfillment/$orderId',
    [RIGHTS.shipmentsView, RIGHTS.shipmentsEdit, RIGHTS.ordersView],
    RIGHTS.stockCardsView,
  ],
] as const)('matches the opening rights for %s', (to, allowed, denied) => {
  expect(canOpen(to, undefined, rightsFor)).toBe(false);
  for (const right of allowed) expect(canOpen(to, new Set([right]), rightsFor)).toBe(true);
  expect(canOpen(to, new Set([denied]), rightsFor)).toBe(false);
});
