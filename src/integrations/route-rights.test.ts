import { type ESTree, parseSync, Visitor } from 'vite';
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
  const livePaths = links(LIVE_NAV_GROUPS).map((link) => link.to);
  for (const to of [
    '/stock-management/adjustments',
    '/stock-management/issue',
    '/stock-management/receive',
    '/stock-management/unpack',
  ]) {
    expect(livePaths).toContain(to);
  }
  for (const to of [...livePaths, '/profile', '/settings']) {
    expect(to && getRoute(to), to).toBeDefined();
    if (to && !openRoutes.has(to)) expect(rightsFor(to)?.length ?? 0, to).toBeGreaterThan(0);
  }
  expect(getRoute('/settings').fullPath).toBe('/settings/');
  expect(getRoute('/settings').options.staticData?.rights).toBeUndefined();
  expect(rightsFor('/settings')).toEqual([RIGHTS.systemSettingsManage]);
});

it('filters the real menu and account links for no rights, some rights and all rights', () => {
  const visible = (rights: ReadonlySet<string> | undefined) =>
    links(
      navWithinRights(LIVE_NAV_GROUPS, rights, rightsFor, false, false, {
        SHOW_REQUISITION_LESS_ORDER: true,
      }),
    ).map((link) => link.to);

  expect(visible(undefined)).toEqual(['/home']);

  const none = new Set<string>();
  expect(visible(none)).toEqual(['/home']);
  expect(canOpen('/profile', none, rightsFor)).toBe(true);
  expect(canOpen('/settings', none, rightsFor)).toBe(false);

  const some = new Set([RIGHTS.usersManage, RIGHTS.facilityApprovedOrderablesManage]);
  expect(visible(some).sort()).toEqual([
    '/administration/products',
    '/administration/rejection-reason-categories',
    '/administration/rejection-reasons',
    '/administration/roles',
    '/administration/users',
    '/home',
  ]);
  expect(canOpen('/settings', some, rightsFor)).toBe(false);

  const all = new Set(Object.values(RIGHTS));
  expect(visible(all)).toEqual(links(LIVE_NAV_GROUPS).map((link) => link.to));
  expect(canOpen('/settings', all, rightsFor)).toBe(true);
});

const guards = new Set([
  'requireRouteRights',
  'loadStockEventPrograms',
  'loadStockEventEditor',
  'stockCardAccess',
  'loadBuqAccess',
  'loadApproveAccess',
  'loadNationalAccess',
  'loadNationalForecast',
]);

function waitsForGuard(node: ESTree.Node | null): boolean {
  if (node?.type !== 'CallExpression') return false;
  const { callee } = node;
  if (callee.type === 'Identifier') return guards.has(callee.name);
  if (callee.type !== 'MemberExpression' || callee.computed) return false;
  if (callee.property.type !== 'Identifier') return false;
  if (callee.property.name === 'then') return waitsForGuard(callee.object);
  const [promises] = node.arguments;
  return (
    callee.object.type === 'Identifier' &&
    callee.object.name === 'Promise' &&
    callee.property.name === 'all' &&
    promises?.type === 'ArrayExpression' &&
    promises.elements.some(waitsForGuard)
  );
}

function inspectRouteSource(path: string, source: string) {
  const { program, errors } = parseSync(path, source);
  expect(errors, path).toEqual([]);
  let id: string | undefined;
  let waitsForRights = false;
  let usesInlineRights = false;
  new Visitor({
    CallExpression({ callee, arguments: [argument] }) {
      if (callee.type !== 'Identifier') return;
      if (
        callee.name === 'createFileRoute' &&
        argument?.type === 'Literal' &&
        typeof argument.value === 'string'
      ) {
        id = argument.value;
      }
      usesInlineRights ||= callee.name === 'requireRight' || callee.name === 'requirePermissions';
    },
    AwaitExpression({ argument }) {
      waitsForRights ||= waitsForGuard(argument);
    },
    ReturnStatement({ argument }) {
      waitsForRights ||= waitsForGuard(argument);
    },
    ArrowFunctionExpression({ body }) {
      waitsForRights ||= waitsForGuard(body);
    },
  }).visit(program);
  return { id, waitsForRights, usesInlineRights };
}

it('ignores commented-out and discarded guard calls', () => {
  const { waitsForRights } = inspectRouteSource(
    'route.tsx',
    `const loader = async () => {
      // await requireRouteRights(queryClient, route);
      /* return requireRouteRights(queryClient, route); */
      void requireRouteRights(queryClient, route);
      await Promise.all([void requireRouteRights(queryClient, route)]);
    };`,
  );
  expect(waitsForRights).toBe(false);
});

it('checks route rights in each route that declares them', () => {
  const sources = import.meta.glob<string>('/src/routes/(protected)/_protected.*.tsx', {
    eager: true,
    query: '?raw',
    import: 'default',
  });
  const customGuards = new Set([
    '/(protected)/_protected/requisitions/view',
    '/(protected)/_protected/requisitions/view_/$requisitionId',
  ]);
  for (const [path, source] of Object.entries(sources)) {
    const { id, waitsForRights, usesInlineRights } = inspectRouteSource(path, source);
    const route = id && routesById[id as keyof typeof routesById];
    expect.soft(Boolean(route), `${path} has no registered route for ${id}`).toBe(true);
    expect.soft(usesInlineRights, `${path} uses inline rights`).toBe(false);
    if (route && route.options.staticData?.rights !== undefined && !customGuards.has(route.id)) {
      expect.soft(waitsForRights, `${path} must await or return a route guard`).toBe(true);
    }
  }
});

it.each([
  ['/administration/manage-buq', [RIGHTS.manageBuq], RIGHTS.reportsView],
  ['/administration/report-categories', [RIGHTS.reportCategoriesManage], RIGHTS.reportsView],
  ['/administration/reports', [RIGHTS.reportsManage], RIGHTS.reportsView],
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
  ['/administration/system-notifications', [RIGHTS.systemNotificationsManage], RIGHTS.usersManage],
  ['/administration/lots', [RIGHTS.lotsManage], RIGHTS.orderablesManage],
  ['/reports', [RIGHTS.reportsView], RIGHTS.usersManage],
  ['/stock-management/adjustments', [RIGHTS.stockAdjust], RIGHTS.stockCardsView],
  ['/stock-management/issue', [RIGHTS.stockAdjust], RIGHTS.stockCardsView],
  ['/stock-management/receive', [RIGHTS.stockAdjust], RIGHTS.stockCardsView],
  ['/stock-management/unpack', [RIGHTS.stockAdjust], RIGHTS.stockCardsView],
  ['/stock-management/physical-inventory', [RIGHTS.stockInventoriesEdit], RIGHTS.stockCardsView],
  [
    '/orders/fulfillment/$orderId',
    [RIGHTS.shipmentsView, RIGHTS.shipmentsEdit, RIGHTS.ordersView],
    RIGHTS.stockCardsView,
  ],
] as const)('matches the opening rights for %s', (to, allowed, denied) => {
  for (const right of allowed) expect(canOpen(to, new Set([right]), rightsFor)).toBe(true);
  expect(canOpen(to, new Set([denied]), rightsFor)).toBe(false);
});
