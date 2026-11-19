import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import { type LucideIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useDeviceWork } from '@/components/app-shell/device-work';
import { rightsOptions } from '@/features/auth/api/queries';
import { requisitionViewNodes } from '@/features/auth/lib/requisition-access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { userRecordOptions } from '@/features/reference-data/api/queries';
import { requisitionRolesOptions } from '@/features/requisitions/lib/offline-access';
import { isNavParent, LIVE_NAV_GROUPS } from '@/lib/config';
import { type FeatureFlagKey, useFlag } from '@/lib/feature-flags';
import { hasOfflineCapability, isOfflineCapable } from '@/lib/offline-pages';
import { useOnline } from '@/lib/online';
import { routeRights } from '@/lib/route-rights';
import type { LiveNavGroup, LiveNavItem, LiveNavLink } from '@/lib/types';

type RightsLookup = (to: string) => readonly string[] | undefined;

export function useRouteRightsLookup(): RightsLookup {
  const routes = useRouter().routesByPath;
  return useCallback(
    (to) =>
      Object.hasOwn(routes, to) ? routeRights(routes[to as keyof typeof routes]) : undefined,
    [routes],
  );
}

export function canOpen(
  to: LiveNavLink['to'],
  rights: ReadonlySet<string> | undefined,
  rightsFor: RightsLookup,
  hasDeviceEvents = false,
  offline = false,
) {
  if (to === '/home' || to === '/profile') return true;
  if (to === '/offline-events' && (hasDeviceEvents || offline)) return true;
  return Boolean(to && rightsFor(to)?.some((name) => rights?.has(name)));
}

/** The nav without the pages `rights` do not reach; gated pages stay out while rights are unknown. */
export function navWithinRights(
  groups: LiveNavGroup[],
  rights: ReadonlySet<string> | undefined,
  rightsFor: RightsLookup,
  hasDeviceEvents = false,
  offline = false,
  flags: Partial<Record<FeatureFlagKey, boolean>> = {},
): LiveNavGroup[] {
  const allowed = (link: LiveNavLink) =>
    (!link.flag || flags[link.flag] !== false) &&
    canOpen(link.to, rights, rightsFor, hasDeviceEvents, offline);
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
  const lookup = Boolean(userId && rights && !rights.has(RIGHTS.requisitionView));
  const user = useQuery({
    ...userRecordOptions(userId ?? '', { connectionStatus: false }),
    enabled: lookup,
    retry: false,
    throwOnError: false,
  });
  const roles = useQuery({
    ...requisitionRolesOptions({ connectionStatus: false }),
    enabled: lookup,
    retry: false,
    throwOnError: false,
  });
  return useMemo(() => {
    if (!lookup || !user.isSuccess || !roles.isSuccess) return rights;
    if (!requisitionViewNodes(user.data, roles.data).length) return rights;
    return new Set([...(rights ?? []), RIGHTS.requisitionView]);
  }, [lookup, rights, user.isSuccess, user.data, roles.isSuccess, roles.data]);
}

/** The signed-in user's nav, for the sidebar and the command palette. */
export function useNavGroups() {
  const rightsFor = useRouteRightsLookup();
  const rights = useSignedInRights();
  const { hasDeviceEvents } = useDeviceWork();
  const online = useOnline();
  const createOrders = useFlag('SHOW_REQUISITION_LESS_ORDER');
  return useMemo<LiveNavGroup[]>(() => {
    const mark = (link: LiveNavLink) => ({
      ...link,
      connectionRequired: !online && !isOfflineCapable(link.to ?? ''),
    });
    return navWithinRights(LIVE_NAV_GROUPS, rights, rightsFor, hasDeviceEvents, !online, {
      SHOW_REQUISITION_LESS_ORDER: createOrders,
    }).map((group) => ({
      ...group,
      items: group.items.map((item) =>
        isNavParent(item)
          ? {
              ...item,
              items: item.items.map(mark),
            }
          : mark(item),
      ),
    }));
  }, [rights, rightsFor, online, hasDeviceEvents, createOrders]);
}

/** Whether the signed-in user may open a nav page, e.g. before linking to it in a breadcrumb. */
export function useCanOpen() {
  const rightsFor = useRouteRightsLookup();
  const rights = useSignedInRights();
  const { hasDeviceEvents } = useDeviceWork();
  const online = useOnline();
  return (to: LiveNavLink['to']) =>
    canOpen(to, rights, rightsFor, hasDeviceEvents, !online) &&
    (online || isOfflineCapable(to ?? ''));
}

type AccountLink = {
  titleKey: ParseKeys;
  to: '/profile' | '/settings';
  icon: LucideIcon;
  connectionRequired?: boolean;
};

export function useAccountLinks(): AccountLink[] {
  const online = useOnline();
  const rightsFor = useRouteRightsLookup();
  const rights = useSignedInRights();
  const settingsOn = useFlag('SYSTEM_SETTINGS');
  const canManageSettings = settingsOn && canOpen('/settings', rights, rightsFor);
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
