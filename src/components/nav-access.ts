import { useQuery } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { type LucideIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { useMemo } from 'react';
import { rightsOptions } from '@/features/auth/api/queries';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { isNavParent, LIVE_NAV_GROUPS } from '@/lib/config';
import { useFlag } from '@/lib/feature-flags';
import type { LiveNavGroup, LiveNavItem, LiveNavLink } from '@/lib/types';

/** The right a page asks for, or a list of which any one opens it, so the nav only offers pages the user can open. */
const NAV_RIGHTS: Partial<Record<NonNullable<LiveNavLink['to']>, string | readonly string[]>> = {
  '/administration/facilities': RIGHTS.facilitiesManage,
  '/administration/facility-types': RIGHTS.facilitiesManage,
  '/administration/lots': RIGHTS.lotsManage,
  '/administration/products': [RIGHTS.orderablesManage, RIGHTS.facilityApprovedOrderablesManage],
  '/administration/users': RIGHTS.usersManage,
  '/administration/roles': RIGHTS.usersManage,
  '/administration/service-accounts': RIGHTS.serviceAccountsManage,
  '/administration/programs': RIGHTS.programsManage,
  '/administration/reasons': RIGHTS.stockCardLineItemReasonsManage,
  '/administration/valid-destinations': RIGHTS.stockDestinationsManage,
  '/administration/valid-sources': RIGHTS.stockSourcesManage,
  '/stock-management/stock-on-hand': RIGHTS.stockCardsView,
};

/** Whether `rights` reach the page at `to`; a gated page is out while rights are unknown. */
export function canOpen(to: LiveNavLink['to'], rights: ReadonlySet<string> | undefined) {
  const right = to && NAV_RIGHTS[to];
  return !right || [right].flat().some((name) => rights?.has(name) ?? false);
}

/** The nav without the pages `rights` do not reach; gated pages stay out while rights are unknown. */
export function navWithinRights(
  groups: LiveNavGroup[],
  rights: ReadonlySet<string> | undefined,
): LiveNavGroup[] {
  const allowed = (link: LiveNavLink) => canOpen(link.to, rights);
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

function useSignedInRights() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  const { data: rights } = useQuery({ ...rightsOptions(userId ?? ''), enabled: Boolean(userId) });
  return rights;
}

/** The signed-in user's nav, for the sidebar and the command palette. */
export function useNavGroups() {
  const rights = useSignedInRights();
  return useMemo(() => navWithinRights(LIVE_NAV_GROUPS, rights), [rights]);
}

export function useHasRight(right: string) {
  return useSignedInRights()?.has(right) ?? false;
}

/** Whether the signed-in user may open a nav page, e.g. before linking to it in a breadcrumb. */
export function useCanOpen() {
  const rights = useSignedInRights();
  return (to: LiveNavLink['to']) => canOpen(to, rights);
}

export type AccountLink = { titleKey: ParseKeys; to: '/profile' | '/settings'; icon: LucideIcon };

export function useAccountLinks(): AccountLink[] {
  const mayManageSettings = useHasRight(RIGHTS.systemSettingsManage);
  const settingsOn = useFlag('SYSTEM_SETTINGS');
  const canManageSettings = mayManageSettings && settingsOn;
  return [
    { titleKey: 'nav-user.account', to: '/profile', icon: UserIcon },
    ...(canManageSettings
      ? [{ titleKey: 'nav-user.settings', to: '/settings', icon: SettingsIcon } as const]
      : []),
  ];
}
