import type { Tour } from '@/features/onboarding/lib/types';
import { viewMenuStep } from '@/features/onboarding/tours/list-steps';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

export const reverseTour: Tour = {
  id: 'stock-reverse',
  routeIds: ['/(protected)/_protected/stock-management/transaction-history_/$eventId_/reverse'],
  steps: [
    {
      anchor: TOUR_ANCHORS.reverseSummary,
      title: 'onboarding.reverse.summary.title',
      content: 'onboarding.reverse.summary.content',
    },
    {
      anchor: TOUR_ANCHORS.reverseUnit,
      title: 'onboarding.transaction-details.unit.title',
      content: 'onboarding.transaction-details.unit.content',
    },
    viewMenuStep,
    {
      // The lines fill the screen, so the tooltip hangs from View just above them.
      anchor: TOUR_ANCHORS.listView,
      spotlight: TOUR_ANCHORS.listTable,
      title: 'onboarding.reverse.lines.title',
      content: 'onboarding.reverse.lines.content',
    },
    {
      anchor: TOUR_ANCHORS.listView,
      spotlight: TOUR_ANCHORS.listTable,
      column: 'stock-event-reverse.reverse',
      title: 'onboarding.reverse.select.title',
      content: 'onboarding.reverse.select.content',
      placement: 'inline-start',
    },
    {
      anchor: TOUR_ANCHORS.listView,
      spotlight: TOUR_ANCHORS.listTable,
      column: 'stock-event-reverse.cancel-reason',
      title: 'onboarding.reverse.reason.title',
      content: 'onboarding.reverse.reason.content',
      placement: 'inline-start',
    },
    {
      anchor: TOUR_ANCHORS.reverseSubmit,
      title: 'onboarding.reverse.submit.title',
      content: 'onboarding.reverse.submit.content',
      placement: 'top',
    },
  ],
};
