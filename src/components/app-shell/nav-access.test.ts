import { HouseIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { canOpen, navWithinRights } from '@/components/app-shell/nav-access';
import { isNavParent } from '@/lib/config';
import type { LiveNavGroup } from '@/lib/types';

const nav: LiveNavGroup[] = [
  { items: [{ titleKey: 'home.title', to: '/home', icon: HouseIcon }] },
  {
    labelKey: 'nav.menu',
    items: [
      {
        titleKey: 'nav.administration',
        items: [{ titleKey: 'nav.administration.users', to: '/administration/users' }],
      },
    ],
  },
];

const rightsByPath: Record<string, string[]> = {
  '/administration/users': ['USERS_MANAGE'],
  '/offline-events': ['STOCK_ADJUST'],
  '/stock-management/adjustments': ['STOCK_ADJUST'],
  '/requisitions/create-orders': ['ORDER_CREATE'],
};
const rightsFor = (to: string) => rightsByPath[to];

const links = (groups: LiveNavGroup[]) =>
  groups.flatMap((group) =>
    group.items.flatMap((item) => (isNavParent(item) ? item.items : [item]).map((link) => link.to)),
  );

describe('navWithinRights', () => {
  it('offers Users only to someone who may manage users', () => {
    expect(links(navWithinRights(nav, new Set(['USERS_MANAGE']), rightsFor))).toEqual([
      '/home',
      '/administration/users',
    ]);
    expect(links(navWithinRights(nav, new Set(['REQUISITION_VIEW']), rightsFor))).toEqual([
      '/home',
    ]);
  });

  it('drops a section left with no page', () => {
    expect(navWithinRights(nav, new Set(), rightsFor)).toHaveLength(1);
  });

  it('hides gated pages while the rights are still loading', () => {
    expect(links(navWithinRights(nav, undefined, rightsFor))).toEqual(['/home']);
  });
});

describe('canOpen', () => {
  it('keeps Offline Events behind adjustment access unless the user owns pending events', () => {
    expect(canOpen('/offline-events', new Set(['STOCK_ADJUST']), rightsFor)).toBe(true);
    expect(canOpen('/offline-events', new Set(['STOCK_CARDS_VIEW']), rightsFor)).toBe(false);
    expect(canOpen('/offline-events', new Set(), rightsFor, true)).toBe(true);
    expect(canOpen('/stock-management/adjustments', new Set(), rightsFor, true)).toBe(false);
  });
  it('lets anyone open a page that needs no right', () => {
    expect(canOpen('/home', undefined, rightsFor)).toBe(true);
    expect(canOpen('/administration/users', new Set(), rightsFor)).toBe(false);
  });
});

it('offers Offline Events offline before access or events have been downloaded', () => {
  expect(canOpen('/offline-events', undefined, rightsFor, false, true)).toBe(true);
  expect(canOpen('/stock-management/adjustments', undefined, rightsFor, false, true)).toBe(false);
});

it('drops the requisitions section when Create Orders is its only permitted page and the flag is off', () => {
  const groups: LiveNavGroup[] = [
    {
      items: [
        {
          titleKey: 'nav.requisitions',
          items: [
            {
              titleKey: 'nav.requisitions.create-orders',
              to: '/requisitions/create-orders',
              flag: 'SHOW_REQUISITION_LESS_ORDER',
            },
          ],
        },
      ],
    },
  ];
  expect(
    navWithinRights(groups, new Set(['ORDER_CREATE']), rightsFor, false, false, {
      SHOW_REQUISITION_LESS_ORDER: false,
    }),
  ).toEqual([]);
});
