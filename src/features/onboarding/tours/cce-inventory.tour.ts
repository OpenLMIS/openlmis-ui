import type { ParseKeys } from 'i18next';
import type { Tour, TourLegendItem } from '@/features/onboarding/lib/types';
import { ON_LIST, sortStep, viewSortStep } from '@/features/onboarding/tours/list-steps';
import {
  EQUIPMENT_STATUS,
  EQUIPMENT_STATUSES,
  type EquipmentStatus,
} from '@/lib/cce-equipment-status';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

const STATUS_TEXT = {
  FUNCTIONING: 'onboarding.cce-inventory.legend.functioning',
  NEEDS_ATTENTION: 'onboarding.cce-inventory.legend.needs-attention',
  AWAITING_REPAIR: 'onboarding.cce-inventory.legend.awaiting-repair',
  UNSERVICEABLE: 'onboarding.cce-inventory.legend.unserviceable',
} satisfies Record<EquipmentStatus, ParseKeys>;

/** Status badges drawn as the list draws them, so the step reads true on any page of results. */
const statusLegend: TourLegendItem[] = EQUIPMENT_STATUSES.map((status) => {
  const { labelKey, tone, icon } = EQUIPMENT_STATUS[status];
  return { label: labelKey, text: STATUS_TEXT[status], tone, icon };
});

export const cceInventoryTour: Tour = {
  id: 'cce-inventory',
  routeIds: ['/(protected)/_protected/cce/inventory'],
  steps: [
    {
      anchor: TOUR_ANCHORS.ccePicker,
      title: 'onboarding.cce-inventory.picker.title',
      content: 'onboarding.cce-inventory.picker.content',
    },
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.cce-inventory.filters.title',
      content: 'onboarding.cce-inventory.filters.content',
    },
    viewSortStep,
    {
      anchor: TOUR_ANCHORS.cceExport,
      title: 'onboarding.cce-inventory.export.title',
      content: 'onboarding.cce-inventory.export.content',
    },
    {
      anchor: TOUR_ANCHORS.cceAdd,
      title: 'onboarding.cce-inventory.add.title',
      content: 'onboarding.cce-inventory.add.content',
    },
    {
      ...ON_LIST,
      title: 'onboarding.cce-inventory.results.title',
      content: 'onboarding.cce-inventory.results.content',
    },
    {
      ...ON_LIST,
      column: 'cce-inventory.functional-status',
      title: 'onboarding.cce-inventory.status.title',
      content: 'onboarding.cce-inventory.status.content',
      placement: 'inline-start',
      legend: statusLegend,
    },
    sortStep,
    {
      ...ON_LIST,
      column: 'cce-inventory.actions',
      title: 'onboarding.cce-inventory.open.title',
      content: 'onboarding.cce-inventory.open.content',
      placement: 'inline-start',
    },
  ],
};
