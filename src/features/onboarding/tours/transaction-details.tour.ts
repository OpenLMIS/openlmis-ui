import type { Tour } from '@/features/onboarding/lib/types';
import { viewMenuStep } from '@/features/onboarding/tours/list-steps';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

export const transactionDetailsTour: Tour = {
  id: 'transaction-details',
  routeIds: ['/(protected)/_protected/stock-management/transaction-history_/$eventId'],
  steps: [
    {
      anchor: TOUR_ANCHORS.transactionDetailsReverse,
      title: 'onboarding.transaction-details.reverse.title',
      content: 'onboarding.transaction-details.reverse.content',
    },
    {
      anchor: TOUR_ANCHORS.transactionDetailsPrint,
      title: 'onboarding.transaction-details.print.title',
      content: 'onboarding.transaction-details.print.content',
    },
    {
      anchor: TOUR_ANCHORS.transactionDetailsSummary,
      title: 'onboarding.transaction-details.summary.title',
      content: 'onboarding.transaction-details.summary.content',
    },
    {
      anchor: TOUR_ANCHORS.transactionDetailsUnit,
      title: 'onboarding.transaction-details.unit.title',
      content: 'onboarding.transaction-details.unit.content',
    },
    viewMenuStep,
    {
      anchor: TOUR_ANCHORS.transactionDetailsLines,
      title: 'onboarding.transaction-details.lines.title',
      content: 'onboarding.transaction-details.lines.content',
      placement: 'top',
    },
  ],
};
