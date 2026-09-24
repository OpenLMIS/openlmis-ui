import { HouseIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { canOpen, navWithinRights } from '@/components/nav-access';
import { isNavParent } from '@/lib/config';
import type { LiveNavGroup } from '@/lib/types';

// A nav of its own, so adding pages to the real one never breaks these tests.
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

const links = (groups: LiveNavGroup[]) =>
  groups.flatMap((group) =>
    group.items.flatMap((item) => (isNavParent(item) ? item.items : [item]).map((link) => link.to)),
  );

describe('navWithinRights', () => {
  it('offers Users only to someone who may manage users', () => {
    expect(links(navWithinRights(nav, new Set(['USERS_MANAGE'])))).toEqual([
      '/home',
      '/administration/users',
    ]);
    expect(links(navWithinRights(nav, new Set(['REQUISITION_VIEW'])))).toEqual(['/home']);
  });

  it('drops a section left with no page', () => {
    expect(navWithinRights(nav, new Set())).toHaveLength(1);
  });

  it('hides gated pages while the rights are still loading', () => {
    expect(links(navWithinRights(nav, undefined))).toEqual(['/home']);
  });
});

describe('canOpen', () => {
  it('lets anyone open a page that needs no right', () => {
    expect(canOpen('/home', undefined)).toBe(true);
    expect(canOpen('/administration/users', new Set())).toBe(false);
  });
});
