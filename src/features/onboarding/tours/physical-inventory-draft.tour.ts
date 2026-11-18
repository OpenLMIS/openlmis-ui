import type { Tour } from '@/features/onboarding/lib/types';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

// The grid fills the screen, so the tooltip hangs from the toolbar just above it.
const ON_LINES = {
  anchor: TOUR_ANCHORS.physicalInventoryAdd,
  spotlight: TOUR_ANCHORS.physicalInventoryLines,
} as const;

export const physicalInventoryDraftTour: Tour = {
  id: 'physical-inventory-draft',
  routeIds: ['/(protected)/_protected/stock-management/physical-inventory_/$programId'],
  steps: [
    {
      anchor: TOUR_ANCHORS.physicalInventoryProgress,
      title: 'onboarding.physical-inventory-draft.progress.title',
      content: 'onboarding.physical-inventory-draft.progress.content',
    },
    {
      anchor: TOUR_ANCHORS.physicalInventoryFilters,
      title: 'onboarding.physical-inventory-draft.filters.title',
      content: 'onboarding.physical-inventory-draft.filters.content',
    },
    {
      anchor: TOUR_ANCHORS.physicalInventorySaved,
      title: 'onboarding.physical-inventory-draft.saved.title',
      content: 'onboarding.physical-inventory-draft.saved.content',
    },
    {
      anchor: TOUR_ANCHORS.physicalInventoryUnit,
      title: 'onboarding.physical-inventory-draft.unit.title',
      content: 'onboarding.physical-inventory-draft.unit.content',
    },
    {
      anchor: TOUR_ANCHORS.physicalInventoryView,
      title: 'onboarding.physical-inventory-draft.view.title',
      content: 'onboarding.physical-inventory-draft.view.content',
    },
    {
      anchor: TOUR_ANCHORS.physicalInventoryAdd,
      title: 'onboarding.physical-inventory-draft.add.title',
      content: 'onboarding.physical-inventory-draft.add.content',
    },
    {
      ...ON_LINES,
      title: 'onboarding.physical-inventory-draft.lines.title',
      content: 'onboarding.physical-inventory-draft.lines.content',
    },
    {
      ...ON_LINES,
      title: 'onboarding.physical-inventory-draft.reasons.title',
      content: 'onboarding.physical-inventory-draft.reasons.content',
    },
    {
      anchor: TOUR_ANCHORS.physicalInventoryDelete,
      title: 'onboarding.physical-inventory-draft.delete.title',
      content: 'onboarding.physical-inventory-draft.delete.content',
      placement: 'top',
    },
    {
      anchor: TOUR_ANCHORS.physicalInventoryActions,
      title: 'onboarding.physical-inventory-draft.actions.title',
      content: 'onboarding.physical-inventory-draft.actions.content',
      placement: 'top',
    },
  ],
};
