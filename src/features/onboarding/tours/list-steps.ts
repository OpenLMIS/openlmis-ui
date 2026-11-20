import type { TourStep } from '@/features/onboarding/lib/types';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

/** A tall list leaves no room for a tooltip, so list steps hang from View just above it. */
export const ON_LIST = {
  anchor: TOUR_ANCHORS.listView,
  spotlight: TOUR_ANCHORS.listTable,
} as const;

/** Steps for the shared list parts, worded for any list whose View menu has no sort. */
export const viewMenuStep: TourStep = {
  anchor: TOUR_ANCHORS.listView,
  title: 'onboarding.list.view-menu.title',
  content: 'onboarding.list.view-menu.content',
};

/** For lists whose View menu also sorts the cards. */
export const viewSortStep: TourStep = {
  anchor: TOUR_ANCHORS.listView,
  title: 'onboarding.list.view-sort.title',
  content: 'onboarding.list.view-sort.content',
};

export const searchStep: TourStep = {
  anchor: TOUR_ANCHORS.listSearch,
  title: 'onboarding.admin-list.search.title',
  content: 'onboarding.admin-list.search.content',
};

/** Administration's View copy: true where View holds columns, card details or the card sort. */
export const adminViewStep: TourStep = {
  anchor: TOUR_ANCHORS.listView,
  title: 'onboarding.admin-list.view.title',
  content: 'onboarding.admin-list.view.content',
};

export const sortStep: TourStep = {
  anchor: TOUR_ANCHORS.listSort,
  title: 'onboarding.list.sort.title',
  content: 'onboarding.list.sort.content',
};
