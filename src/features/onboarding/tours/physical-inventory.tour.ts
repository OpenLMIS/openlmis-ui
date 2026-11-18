import type { Tour } from '@/features/onboarding/lib/types';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

export const physicalInventoryTour: Tour = {
  id: 'physical-inventory',
  routeIds: ['/(protected)/_protected/stock-management/physical-inventory'],
  steps: [
    {
      anchor: TOUR_ANCHORS.physicalInventoryPrograms,
      title: 'onboarding.physical-inventory.programs.title',
      content: 'onboarding.physical-inventory.programs.content',
    },
  ],
};
