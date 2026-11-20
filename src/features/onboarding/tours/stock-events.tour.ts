import type { Tour } from '@/features/onboarding/lib/types';
import { viewMenuStep } from '@/features/onboarding/tours/list-steps';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

const KINDS = ['issue', 'receive', 'adjustments', 'unpack'] as const;

export const stockEventTours: readonly Tour[] = KINDS.flatMap((kind): Tour[] => [
  {
    id: `stock-${kind}-programs`,
    routeIds: [`/(protected)/_protected/stock-management/${kind}`],
    steps: [
      {
        anchor: TOUR_ANCHORS.stockEventPrograms,
        title: 'onboarding.stock-event.programs.title',
        content: `onboarding.stock-${kind}.programs.content`,
      },
    ],
  },
  {
    id: `stock-${kind}-editor`,
    routeIds: [`/(protected)/_protected/stock-management/${kind}_/$programId`],
    steps: [
      {
        anchor: TOUR_ANCHORS.stockEventPicker,
        title: `onboarding.stock-${kind}.picker.title`,
        content: `onboarding.stock-${kind}.picker.content`,
      },
      {
        anchor: TOUR_ANCHORS.listSearch,
        title: 'onboarding.stock-event.search.title',
        content: 'onboarding.stock-event.search.content',
      },
      {
        anchor: TOUR_ANCHORS.stockEventSaved,
        title: 'onboarding.stock-event.saved.title',
        content: 'onboarding.stock-event.saved.content',
      },
      {
        anchor: TOUR_ANCHORS.stockEventUnit,
        title: 'onboarding.stock-event.unit.title',
        content: 'onboarding.stock-event.unit.content',
      },
      viewMenuStep,
      {
        // The lines fill the screen, so the tooltip hangs from the toolbar just above them.
        anchor: TOUR_ANCHORS.listView,
        spotlight: TOUR_ANCHORS.stockEventLines,
        title: 'onboarding.stock-event.lines.title',
        content: `onboarding.stock-${kind}.lines.content`,
      },
      {
        anchor: TOUR_ANCHORS.stockEventClear,
        title: 'onboarding.stock-event.clear.title',
        content: 'onboarding.stock-event.clear.content',
        placement: 'top',
      },
      {
        anchor: TOUR_ANCHORS.stockEventSubmit,
        title: 'onboarding.stock-event.submit.title',
        content: `onboarding.stock-${kind}.submit.content`,
        placement: 'top',
      },
    ],
  },
]);
