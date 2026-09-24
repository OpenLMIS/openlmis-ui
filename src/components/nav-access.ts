import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { rightsOptions } from '@/features/auth/api/queries';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { isNavParent, LIVE_NAV_GROUPS } from '@/lib/config';
import type { LiveNavGroup, LiveNavItem, LiveNavLink } from '@/lib/types';

/** The right a page asks for, so the nav only offers pages the user can open. */
const NAV_RIGHTS: Partial<Record<string, string>> = {
  '/administration/users': RIGHTS.usersManage,
};

/** The nav without the pages `rights` do not reach; gated pages stay out while rights are unknown. */
export function navWithinRights(
  groups: LiveNavGroup[],
  rights: ReadonlySet<string> | undefined,
): LiveNavGroup[] {
  const allowed = (link: LiveNavLink) => {
    const right = NAV_RIGHTS[String(link.to)];
    return !right || (rights?.has(right) ?? false);
  };
  return groups
    .map((group) => ({
      ...group,
      items: group.items.flatMap((item): LiveNavItem[] => {
        if (!isNavParent(item)) return allowed(item) ? [item] : [];
        const items = item.items.filter(allowed);
        return items.length > 0 ? [{ ...item, items }] : [];
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/** The signed-in user's nav, for the sidebar and the command palette. */
export function useNavGroups() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  const { data: rights } = useQuery({ ...rightsOptions(userId ?? ''), enabled: Boolean(userId) });
  return useMemo(() => navWithinRights(LIVE_NAV_GROUPS, rights), [rights]);
}
