import type { Tour } from '@/features/onboarding/lib/types';
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
      anchor: TOUR_ANCHORS.requisitionsFilters,
      title: 'onboarding.requisitions-view.filters.title',
      content: 'onboarding.requisitions-view.filters.content',
    },
    {
      anchor: TOUR_ANCHORS.requisitionsResults,
      title: 'onboarding.requisitions-view.results.title',
      content: 'onboarding.requisitions-view.results.content',
      placement: 'top',
    },
    {
      anchor: TOUR_ANCHORS.requisitionsViewMenu,
      title: 'onboarding.requisitions-view.view-menu.title',
      content: 'onboarding.requisitions-view.view-menu.content',
    },
  ],
};
