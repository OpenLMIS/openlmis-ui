import {
  BellIcon,
  CalculatorIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  HouseIcon,
  RefrigeratorIcon,
  Settings2Icon,
  TruckIcon,
  WarehouseIcon,
} from 'lucide-react';
import type {
  LiveNavGroup,
  LiveNavItem,
  LiveNavLink,
  NavGroup,
  NavItem,
  NavLink,
  SupportedLanguage,
  TextDirection,
} from '@/lib/types';

export const appConfig = {
  BRAND: 'OpenLMIS',
  NAME: 'OpenLMIS UI',
  DESCRIPTION: 'Web frontend for OpenLMIS.',
} as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'pt', name: 'Português', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
] as const satisfies readonly SupportedLanguage[];

export const DEFAULT_TEXT_DIRECTION: TextDirection = 'ltr';

/** Region subtags are ignored: `ar-EG` resolves through `ar`. */
export function getTextDirection(language: string | undefined): TextDirection {
  const code = language?.split('-')[0];
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code)?.dir ?? DEFAULT_TEXT_DIRECTION;
}

// Drives both the sidebar and the command palette.
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { titleKey: 'home.title', to: '/home', icon: HouseIcon },
      { titleKey: 'nav.notifications', to: '#', icon: BellIcon },
    ],
  },
  {
    labelKey: 'nav.menu',
    items: [
      {
        titleKey: 'nav.buq',
        icon: CalculatorIcon,
        items: [
          { titleKey: 'nav.buq.prepare', to: '#' },
          { titleKey: 'nav.buq.create-authorize', to: '#' },
          { titleKey: 'nav.buq.approve', to: '#' },
          { titleKey: 'nav.buq.national-approvals', to: '#' },
        ],
      },
      {
        titleKey: 'nav.cce',
        icon: RefrigeratorIcon,
        items: [{ titleKey: 'nav.cce.inventory', to: '#' }],
      },
      {
        titleKey: 'nav.orders',
        icon: TruckIcon,
        items: [
          { titleKey: 'nav.orders.fulfill', to: '#' },
          { titleKey: 'nav.orders.proof-of-delivery', to: '#' },
          { titleKey: 'nav.orders.view', to: '#' },
        ],
      },
      {
        titleKey: 'nav.reports',
        icon: ChartColumnIcon,
        items: [{ titleKey: 'nav.reports.view', to: '#' }],
      },
      {
        titleKey: 'nav.requisitions',
        icon: ClipboardListIcon,
        items: [
          { titleKey: 'nav.requisitions.create-orders', to: '#' },
          { titleKey: 'nav.requisitions.create-authorize', to: '#' },
          { titleKey: 'nav.requisitions.approve', to: '#' },
          { titleKey: 'nav.requisitions.convert-to-order', to: '#' },
          { titleKey: 'nav.requisitions.view', to: '#' },
        ],
      },
      {
        titleKey: 'nav.stock-management',
        icon: WarehouseIcon,
        items: [
          { titleKey: 'nav.stock-management.unpack', to: '#' },
          { titleKey: 'nav.stock-management.issue', to: '#' },
          { titleKey: 'nav.stock-management.receive', to: '#' },
          { titleKey: 'nav.stock-management.physical-inventory', to: '#' },
          { titleKey: 'nav.stock-management.adjustments', to: '#' },
          { titleKey: 'nav.stock-management.stock-on-hand', to: '#' },
        ],
      },
      {
        titleKey: 'nav.administration',
        icon: Settings2Icon,
        items: [
          { titleKey: 'nav.administration.manage-buq', to: '#' },
          { titleKey: 'nav.administration.data-export', to: '#' },
          { titleKey: 'nav.administration.data-import', to: '#' },
          { titleKey: 'nav.administration.reports', to: '#' },
          { titleKey: 'nav.administration.report-categories', to: '#' },
          { titleKey: 'nav.administration.equipment', to: '#' },
          { titleKey: 'nav.administration.facilities', to: '#' },
          { titleKey: 'nav.administration.facility-types', to: '#' },
          { titleKey: 'nav.administration.geographic-zones', to: '#' },
          { titleKey: 'nav.administration.ideal-stock-amounts', to: '#' },
          { titleKey: 'nav.administration.lots', to: '#' },
          { titleKey: 'nav.administration.one-network-integration', to: '#' },
          { titleKey: 'nav.administration.products', to: '#' },
          { titleKey: 'nav.administration.processing-schedules', to: '#' },
          { titleKey: 'nav.administration.programs', to: '#' },
          { titleKey: 'nav.administration.reasons', to: '#' },
          { titleKey: 'nav.administration.rejection-reason-category', to: '#' },
          { titleKey: 'nav.administration.rejection-reason', to: '#' },
          { titleKey: 'nav.administration.requisition-groups', to: '#' },
          { titleKey: 'nav.administration.requisition-templates', to: '#' },
          { titleKey: 'nav.administration.roles', to: '#' },
          { titleKey: 'nav.administration.service-accounts', to: '#' },
          { titleKey: 'nav.administration.supervisory-nodes', to: '#' },
          { titleKey: 'nav.administration.supply-lines', to: '#' },
          { titleKey: 'nav.administration.supply-partners', to: '#' },
          { titleKey: 'nav.administration.system-notifications', to: '#' },
          { titleKey: 'nav.administration.users', to: '/administration/users' },
          { titleKey: 'nav.administration.valid-destinations', to: '#' },
          { titleKey: 'nav.administration.valid-sources', to: '#' },
        ],
      },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const isNavParent = <T extends NavItem | LiveNavItem>(
  item: T,
): item is Extract<T, { items: unknown }> => 'items' in item;

const isLiveLink = (link: NavLink): link is LiveNavLink => link.to !== '#';

/** The nav without pages not migrated yet; a section shows once one of its pages is live. */
export const LIVE_NAV_GROUPS: LiveNavGroup[] = NAV_GROUPS.map((group) => ({
  ...group,
  items: group.items.flatMap((item): LiveNavItem[] => {
    if (!isNavParent(item)) return isLiveLink(item) ? [item] : [];
    const items = item.items.filter(isLiveLink);
    return items.length > 0 ? [{ ...item, items }] : [];
  }),
})).filter((group) => group.items.length > 0);

export type NavTrailItem = { titleKey: NavItem['titleKey']; to?: NavLink['to'] };

/** The nav entries leading to `pathname`, or to the entry it sits below; empty off the nav. */
export function getNavTrail(pathname: string): NavTrailItem[] {
  return (
    findNavTrail((to) => to === pathname) ??
    findNavTrail((to) => to !== '#' && pathname.startsWith(`${to}/`)) ??
    []
  );
}

function findNavTrail(matches: (to: NavLink['to']) => boolean): NavTrailItem[] | undefined {
  for (const item of NAV_ITEMS) {
    if (!isNavParent(item)) {
      if (matches(item.to)) return [{ titleKey: item.titleKey, to: item.to }];
      continue;
    }
    const child = item.items.find((link) => matches(link.to));
    if (child) return [{ titleKey: item.titleKey }, { titleKey: child.titleKey, to: child.to }];
  }
  return undefined;
}
