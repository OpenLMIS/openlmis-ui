import {
  BarChart3Icon,
  BookOpenIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  SettingsIcon,
  SparklesIcon,
  TrendingUpIcon,
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

// Drives both the sidebar and the command palette.
export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.main',
    items: [{ titleKey: 'dashboard.title', to: '/dashboard', icon: LayoutDashboardIcon }],
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
