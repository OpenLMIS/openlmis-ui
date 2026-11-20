import type { Tour } from '@/features/onboarding/lib/types';
import { viewMenuStep } from '@/features/onboarding/tours/list-steps';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

export const stockOnHandTour: Tour = {
  id: 'stock-on-hand',
  routeIds: ['/(protected)/_protected/stock-management/stock-on-hand'],
  steps: [
    {
      anchor: TOUR_ANCHORS.stockOnHandPicker,
      title: 'onboarding.stock-on-hand.picker.title',
      content: 'onboarding.stock-on-hand.picker.content',
    },
    {
      anchor: TOUR_ANCHORS.listSearch,
      title: 'onboarding.stock-on-hand.search.title',
      content: 'onboarding.stock-on-hand.search.content',
    },
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.stock-on-hand.filters.title',
      content: 'onboarding.stock-on-hand.filters.content',
    },
    {
      anchor: TOUR_ANCHORS.stockOnHandUnit,
      title: 'onboarding.stock-on-hand.unit.title',
      content: 'onboarding.stock-on-hand.unit.content',
    },
    viewMenuStep,
    {
      anchor: TOUR_ANCHORS.stockOnHandPrint,
      title: 'onboarding.stock-on-hand.print.title',
      content: 'onboarding.stock-on-hand.print.content',
    },
    {
      anchor: TOUR_ANCHORS.stockOnHandResults,
      title: 'onboarding.stock-on-hand.results.title',
      content: 'onboarding.stock-on-hand.results.content',
      placement: 'top',
    },
  ],
};
