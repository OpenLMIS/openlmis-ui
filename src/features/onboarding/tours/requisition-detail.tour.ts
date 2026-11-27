import type { Tour } from '@/features/onboarding/lib/types';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

export const requisitionDetailTour: Tour = {
  id: 'requisition-detail',
  routeIds: ['/(protected)/_protected/requisitions/view_/$requisitionId'],
  steps: [
    {
      anchor: TOUR_ANCHORS.requisitionHeader,
      title: 'onboarding.requisition-detail.header.title',
      content: 'onboarding.requisition-detail.header.content',
    },
    {
      anchor: TOUR_ANCHORS.requisitionComments,
      title: 'onboarding.requisition-detail.comments.title',
      content: 'onboarding.requisition-detail.comments.content',
    },
    {
      anchor: TOUR_ANCHORS.requisitionTabs,
      title: 'onboarding.requisition-detail.tabs.title',
      content: 'onboarding.requisition-detail.tabs.content',
    },
    {
      anchor: TOUR_ANCHORS.requisitionGridToolbar,
      title: 'onboarding.requisition-detail.grid-toolbar.title',
      content: 'onboarding.requisition-detail.grid-toolbar.content',
    },
    {
      anchor: TOUR_ANCHORS.requisitionGrid,
      title: 'onboarding.requisition-detail.grid.title',
      content: 'onboarding.requisition-detail.grid.content',
      placement: 'top',
    },
    {
      anchor: TOUR_ANCHORS.requisitionTotals,
      title: 'onboarding.requisition-detail.totals.title',
      content: 'onboarding.requisition-detail.totals.content',
      placement: 'top',
    },
    {
      anchor: TOUR_ANCHORS.requisitionActions,
      title: 'onboarding.requisition-detail.actions.title',
      content: 'onboarding.requisition-detail.actions.content',
      placement: 'top',
    },
  ],
};
