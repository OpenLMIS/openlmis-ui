import type { Tour, TourStep } from '@/features/onboarding/lib/types';
import { sectionAnchor, TOUR_ANCHORS } from '@/lib/tour-anchors';

const SECTIONS = [
  'buq',
  'cce',
  'orders',
  'reports',
  'requisitions',
  'stock-management',
  'administration',
] as const;

export const homeTour: Tour = {
  id: 'home',
  routeIds: ['/(protected)/_protected/home'],
  steps: [
    {
      anchor: TOUR_ANCHORS.homeDashboard,
      title: 'onboarding.home.dashboard.title',
      content: 'onboarding.home.dashboard.content',
      placement: 'center',
    },
    {
      anchor: TOUR_ANCHORS.shellNavigation,
      title: 'onboarding.home.navigation.title',
      content: 'onboarding.home.navigation.content',
      placement: 'inline-end',
    },
    ...SECTIONS.map(
      (name): TourStep => ({
        anchor: sectionAnchor(`nav.${name}`),
        spotlight: TOUR_ANCHORS.shellNavigation,
        title: `nav.${name}`,
        content: `onboarding.home.section.${name}`,
        placement: 'inline-end',
        expand: true,
      }),
    ),
    {
      anchor: TOUR_ANCHORS.shellMenuToggle,
      title: 'onboarding.home.menu-toggle.title',
      content: 'onboarding.home.menu-toggle.content',
    },
    {
      anchor: TOUR_ANCHORS.shellSearch,
      title: 'onboarding.home.search.title',
      content: 'onboarding.home.search.content',
    },
    {
      anchor: TOUR_ANCHORS.shellAccount,
      title: 'onboarding.home.account.title',
      content: 'onboarding.home.account.content',
    },
    {
      anchor: TOUR_ANCHORS.shellStatus,
      title: 'onboarding.home.status.title',
      content: 'onboarding.home.status.content',
      placement: 'inline-end',
    },
    {
      anchor: TOUR_ANCHORS.shellGuide,
      title: 'onboarding.home.guide.title',
      content: 'onboarding.home.guide.content',
    },
  ],
};
