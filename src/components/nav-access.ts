import { useQuery } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { type LucideIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useDeviceWork } from '@/components/device-work';
import { rightsOptions } from '@/features/auth/api/queries';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { isNavParent, LIVE_NAV_GROUPS } from '@/lib/config';
import { useFlag } from '@/lib/feature-flags';
import { navRightFor } from '@/lib/nav-rights';
import { hasOfflineCapability, isOfflineCapable } from '@/lib/offline-pages';
import { useOnline } from '@/lib/online';
import type { LiveNavGroup, LiveNavItem, LiveNavLink } from '@/lib/types';

/** Whether `rights` reach the page at `to`; a gated page is out while rights are unknown. */
export function canOpen(
  to: LiveNavLink['to'],
  rights: ReadonlySet<string> | undefined,
  hasDeviceEvents = false,
  offline = false,
) {
  if (to === '/offline-events' && (hasDeviceEvents || offline)) return true;
  const right = to && navRightFor(to);
  return !right || [right].flat().some((name) => rights?.has(name) ?? false);
}

/** The nav without the pages `rights` do not reach; gated pages stay out while rights are unknown. */
export function navWithinRights(
  groups: LiveNavGroup[],
  rights: ReadonlySet<string> | undefined,
  hasDeviceEvents = false,
  offline = false,
): LiveNavGroup[] {
  const allowed = (link: LiveNavLink) => canOpen(link.to, rights, hasDeviceEvents, offline);
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
  const { hasDeviceEvents } = useDeviceWork();
  const online = useOnline();
  return useMemo<LiveNavGroup[]>(() => {
    const mark = (link: LiveNavLink) => ({
      ...link,
      connectionRequired: !online && !isOfflineCapable(link.to ?? ''),
    });
    return navWithinRights(LIVE_NAV_GROUPS, rights, hasDeviceEvents, !online).map((group) => ({
      ...group,
      items: group.items.map((item) =>
        isNavParent(item) ? { ...item, items: item.items.map(mark) } : mark(item),
      ),
    }));
  }, [rights, online, hasDeviceEvents]);
}

export function useHasRight(right: string) {
  return useSignedInRights()?.has(right) ?? false;
}

/** Whether the signed-in user may open a nav page, e.g. before linking to it in a breadcrumb. */
export function useCanOpen() {
  const rights = useSignedInRights();
  const { hasDeviceEvents } = useDeviceWork();
  const online = useOnline();
  return (to: LiveNavLink['to']) =>
    canOpen(to, rights, hasDeviceEvents, !online) && (online || isOfflineCapable(to ?? ''));
}

type AccountLink = {
  titleKey: ParseKeys;
  to: '/profile' | '/settings';
  icon: LucideIcon;
  connectionRequired?: boolean;
};

export function useAccountLinks(): AccountLink[] {
  const online = useOnline();
  const mayManageSettings = useHasRight(RIGHTS.systemSettingsManage);
  const settingsOn = useFlag('SYSTEM_SETTINGS');
  const canManageSettings = mayManageSettings && settingsOn;
  return [
    { titleKey: 'nav-user.account', to: '/profile', icon: UserIcon, connectionRequired: !online },
    ...(canManageSettings
      ? [
          {
            titleKey: 'nav-user.settings',
            to: '/settings',
            icon: SettingsIcon,
            connectionRequired: !online,
          } as const,
        ]
      : []),
  ];
}

export function useHasOfflineCapability() {
  return hasOfflineCapability(useSignedInRights());
}
