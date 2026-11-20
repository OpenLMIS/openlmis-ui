import type { Tour } from '@/features/onboarding/lib/types';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

export const stockCardTour: Tour = {
  id: 'stock-card',
  routeIds: ['/(protected)/_protected/stock-management/stock-on-hand_/$stockCardId'],
  steps: [
    {
      anchor: TOUR_ANCHORS.stockCardPrint,
      title: 'onboarding.stock-card.print.title',
      content: 'onboarding.stock-card.print.content',
    },
    {
      anchor: TOUR_ANCHORS.stockCardSummary,
      title: 'onboarding.stock-card.summary.title',
      content: 'onboarding.stock-card.summary.content',
    },
    {
      anchor: TOUR_ANCHORS.stockCardUnit,
      title: 'onboarding.stock-card.unit.title',
      content: 'onboarding.stock-card.unit.content',
    },
    {
      anchor: TOUR_ANCHORS.listView,
      title: 'onboarding.stock-card.view.title',
      content: 'onboarding.stock-card.view.content',
    },
    {
      anchor: TOUR_ANCHORS.stockCardLines,
      title: 'onboarding.stock-card.lines.title',
      content: 'onboarding.stock-card.lines.content',
      placement: 'top',
    },
  ],
};
