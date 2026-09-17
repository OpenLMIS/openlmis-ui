import {
  BarChart3Icon,
  BookOpenIcon,
  Building2Icon,
  FilePlus2Icon,
  LayoutDashboardIcon,
  LineChartIcon,
  LogInIcon,
  PackageIcon,
  SettingsIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
} from 'lucide-react';
import type { NavGroup, NavItem } from '@/lib/types';

export const appConfig = {
  BRAND: 'OpenLMIS',
  NAME: 'OpenLMIS UI',
  DESCRIPTION: 'Web frontend for OpenLMIS.',
} as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'pl', name: 'Polski' },
] as const;

// Sidebar navigation. Items with `to: '#'` are mocked placeholders - they render
// as non-navigating buttons so the sidebar has realistic content.
// Replace `to: '#'` with a real route path when the feature is implemented.
export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.main',
    items: [
      { titleKey: 'dashboard.title', to: '/dashboard', icon: LayoutDashboardIcon },
      { titleKey: 'customers.title', to: '/customers', icon: Building2Icon },
      { titleKey: 'users.title', to: '/users', icon: UsersIcon },
      { titleKey: 'login.title', to: '/login', icon: LogInIcon },
    ],
  },
  {
    labelKey: 'nav.forms',
    items: [
      { titleKey: 'new-project.title', to: '/new-project', icon: FilePlus2Icon },
      { titleKey: 'stock-movement.title', to: '/stock-movement', icon: PackageIcon },
    ],
  },
  {
    labelKey: 'nav.analytics',
    items: [
      { titleKey: 'nav.reports', to: '#', icon: BarChart3Icon },
      { titleKey: 'nav.insights', to: '#', icon: SparklesIcon },
      { titleKey: 'nav.trends', to: '#', icon: TrendingUpIcon },
      { titleKey: 'nav.metrics', to: '#', icon: LineChartIcon },
    ],
  },
  {
    labelKey: 'nav.other',
    items: [
      { titleKey: 'nav.documentation', to: '#', icon: BookOpenIcon },
      { titleKey: 'nav.settings', to: '#', icon: SettingsIcon },
    ],
  },
];

export const NAV_LINKS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
