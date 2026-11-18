import { CircleDashedIcon, CircleXIcon, FilePenLineIcon, WifiOffIcon } from 'lucide-react';
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
      column: 'physical-inventory.status',
      placement: 'inline-start',
      legend: [
        {
          label: 'physical-inventory.not-started',
          text: 'onboarding.physical-inventory.legend.not-started',
          tone: 'secondary',
          icon: CircleDashedIcon,
        },
        {
          label: 'physical-inventory.draft',
          text: 'onboarding.physical-inventory.legend.draft',
          tone: 'info',
          icon: FilePenLineIcon,
        },
        {
          label: 'physical-inventory.not-on-device',
          text: 'onboarding.physical-inventory.legend.not-on-device',
          tone: 'warning',
          icon: WifiOffIcon,
        },
        {
          label: 'physical-inventory.status-error',
          text: 'onboarding.physical-inventory.legend.status-error',
          tone: 'destructive',
          icon: CircleXIcon,
        },
      ],
    },
    {
      anchor: TOUR_ANCHORS.physicalInventoryPrograms,
      title: 'onboarding.physical-inventory.actions.title',
      content: 'onboarding.physical-inventory.actions.content',
      column: 'physical-inventory.actions',
      placement: 'inline-start',
    },
  ],
};
