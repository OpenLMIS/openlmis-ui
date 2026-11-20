import type { Tour } from '@/features/onboarding/lib/types';
import { viewMenuStep } from '@/features/onboarding/tours/list-steps';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

export const transactionHistoryTour: Tour = {
  id: 'transaction-history',
  routeIds: ['/(protected)/_protected/stock-management/transaction-history'],
  steps: [
    {
      anchor: TOUR_ANCHORS.transactionHistoryPicker,
      title: 'onboarding.transaction-history.picker.title',
      content: 'onboarding.transaction-history.picker.content',
    },
    {
      anchor: TOUR_ANCHORS.listSearch,
      title: 'onboarding.transaction-history.search.title',
      content: 'onboarding.transaction-history.search.content',
    },
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.transaction-history.filters.title',
      content: 'onboarding.transaction-history.filters.content',
    },
    viewMenuStep,
    {
      anchor: TOUR_ANCHORS.transactionHistoryResults,
      title: 'onboarding.transaction-history.results.title',
      content: 'onboarding.transaction-history.results.content',
      placement: 'top',
    },
  ],
};
