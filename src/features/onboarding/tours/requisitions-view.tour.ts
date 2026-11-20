import type { Tour } from '@/features/onboarding/lib/types';
import { viewSortStep } from '@/features/onboarding/tours/list-steps';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

export const requisitionsViewTour: Tour = {
  id: 'requisitions-view',
  routeIds: ['/(protected)/_protected/requisitions/view'],
  steps: [
    {
      anchor: TOUR_ANCHORS.requisitionsPicker,
      title: 'onboarding.requisitions-view.picker.title',
      content: 'onboarding.requisitions-view.picker.content',
    },
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.requisitions-view.filters.title',
      content: 'onboarding.requisitions-view.filters.content',
    },
    viewSortStep,
    {
      // A tall list leaves no room above it, so the tooltip hangs from View just above it.
      anchor: TOUR_ANCHORS.listView,
      spotlight: TOUR_ANCHORS.requisitionsResults,
      title: 'onboarding.requisitions-view.results.title',
      content: 'onboarding.requisitions-view.results.content',
    },
  ],
};
