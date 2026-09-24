import { describe, expect, it } from 'vitest';
import { navWithinRights } from '@/components/nav-access';
import { LIVE_NAV_GROUPS } from '@/lib/config';

const links = (groups: ReturnType<typeof navWithinRights>) =>
  groups.flatMap((group) =>
    group.items.flatMap((item) => ('items' in item ? item.items : [item]).map((link) => link.to)),
  );

describe('navWithinRights', () => {
  it('offers Users only to someone who may manage users', () => {
    expect(links(navWithinRights(LIVE_NAV_GROUPS, new Set(['USERS_MANAGE'])))).toContain(
      '/administration/users',
    );
    expect(links(navWithinRights(LIVE_NAV_GROUPS, new Set(['REQUISITION_VIEW'])))).not.toContain(
      '/administration/users',
    );
  });

  it('drops a section left with no page, and keeps pages that need no right', () => {
    const groups = navWithinRights(LIVE_NAV_GROUPS, new Set());
    expect(links(groups)).toEqual(['/home']);
    expect(groups.some((group) => group.items.some((item) => 'items' in item))).toBe(false);
  });

  it('hides gated pages while the rights are still loading', () => {
    expect(links(navWithinRights(LIVE_NAV_GROUPS, undefined))).not.toContain(
      '/administration/users',
    );
  });
});
