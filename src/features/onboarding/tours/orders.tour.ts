import type { Tour } from '@/features/onboarding/lib/types';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

const viewMenuStep = {
  anchor: TOUR_ANCHORS.listView,
  title: 'onboarding.orders-list.view-menu.title',
  content: 'onboarding.orders-list.view-menu.content',
} as const;

const pagerStep = {
  anchor: TOUR_ANCHORS.listPager,
  title: 'onboarding.list.pager.title',
  content: 'onboarding.list.pager.content',
  placement: 'top',
} as const;

const ordersViewTour: Tour = {
  id: 'orders-view',
  routeIds: ['/(protected)/_protected/orders/view'],
  steps: [
    {
      anchor: TOUR_ANCHORS.ordersSupplier,
      title: 'onboarding.orders-view.supplier.title',
      content: 'onboarding.orders-view.supplier.content',
    },
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.orders-view.filters.title',
      content: 'onboarding.orders-view.filters.content',
    },
    viewMenuStep,
    {
      // A tall list leaves no room above it, so the tooltip hangs from View just above it.
      anchor: TOUR_ANCHORS.listView,
      spotlight: TOUR_ANCHORS.listTable,
      title: 'onboarding.orders-view.results.title',
      content: 'onboarding.orders-view.results.content',
    },
    {
      anchor: TOUR_ANCHORS.listSort,
      title: 'onboarding.orders-view.sort.title',
      content: 'onboarding.orders-view.sort.content',
    },
    {
      // Rows offer different actions by status and rights, so the step highlights the column.
      anchor: TOUR_ANCHORS.listView,
      spotlight: TOUR_ANCHORS.listTable,
      column: 'orders.view.columns.actions',
      title: 'onboarding.orders-view.actions.title',
      content: 'onboarding.orders-view.actions.content',
      placement: 'inline-start',
    },
    pagerStep,
  ],
};

const fulfillmentTour: Tour = {
  id: 'orders-fulfillment',
  routeIds: ['/(protected)/_protected/orders/fulfillment'],
  steps: [
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.orders-fulfillment.filters.title',
      content: 'onboarding.orders-fulfillment.filters.content',
    },
    {
      anchor: TOUR_ANCHORS.fulfillSort,
      title: 'onboarding.orders-fulfillment.sort.title',
      content: 'onboarding.orders-fulfillment.sort.content',
    },
    viewMenuStep,
    {
      anchor: TOUR_ANCHORS.listView,
      spotlight: TOUR_ANCHORS.listTable,
      title: 'onboarding.orders-fulfillment.results.title',
      content: 'onboarding.orders-fulfillment.results.content',
    },
    {
      anchor: TOUR_ANCHORS.fulfillStart,
      title: 'onboarding.orders-fulfillment.start.title',
      content: 'onboarding.orders-fulfillment.start.content',
      placement: 'inline-start',
    },
    pagerStep,
  ],
};

const shipmentTour: Tour = {
  id: 'orders-shipment',
  routeIds: ['/(protected)/_protected/orders/fulfillment_/$orderId'],
  steps: [
    {
      anchor: TOUR_ANCHORS.orderSummary,
      title: 'onboarding.orders-shipment.summary.title',
      content: 'onboarding.orders-shipment.summary.content',
    },
    {
      anchor: TOUR_ANCHORS.orderUnit,
      title: 'onboarding.orders-shipment.unit.title',
      content: 'onboarding.orders-shipment.unit.content',
    },
    {
      // The lines fill the screen, so the tooltip hangs from the summary just above them.
      anchor: TOUR_ANCHORS.orderSummary,
      spotlight: TOUR_ANCHORS.shipmentLines,
      title: 'onboarding.orders-shipment.lines.title',
      content: 'onboarding.orders-shipment.lines.content',
    },
    {
      anchor: TOUR_ANCHORS.shipmentFill,
      spotlight: TOUR_ANCHORS.shipmentLines,
      column: 'orders.shipment.fill',
      title: 'onboarding.orders-shipment.fill.title',
      content: 'onboarding.orders-shipment.fill.content',
      placement: 'inline-start',
    },
    {
      anchor: TOUR_ANCHORS.shipmentDraft,
      title: 'onboarding.orders-shipment.draft.title',
      content: 'onboarding.orders-shipment.draft.content',
      placement: 'top',
    },
    {
      anchor: TOUR_ANCHORS.shipmentActions,
      title: 'onboarding.orders-shipment.actions.title',
      content: 'onboarding.orders-shipment.actions.content',
      placement: 'top',
    },
  ],
};

const podTour: Tour = {
  id: 'orders-pod',
  routeIds: ['/(protected)/_protected/orders/proof-of-delivery'],
  steps: [
    {
      anchor: TOUR_ANCHORS.podPicker,
      title: 'onboarding.orders-pod.picker.title',
      content: 'onboarding.orders-pod.picker.content',
    },
    viewMenuStep,
    {
      anchor: TOUR_ANCHORS.listView,
      spotlight: TOUR_ANCHORS.listTable,
      title: 'onboarding.orders-pod.results.title',
      content: 'onboarding.orders-pod.results.content',
    },
    {
      anchor: TOUR_ANCHORS.listSort,
      title: 'onboarding.orders-pod.sort.title',
      content: 'onboarding.orders-pod.sort.content',
    },
    {
      anchor: TOUR_ANCHORS.podManage,
      title: 'onboarding.orders-pod.manage.title',
      content: 'onboarding.orders-pod.manage.content',
      placement: 'inline-start',
    },
    pagerStep,
  ],
};

const podDetailTour: Tour = {
  id: 'orders-pod-detail',
  routeIds: ['/(protected)/_protected/orders/proof-of-delivery_/$podId'],
  steps: [
    {
      anchor: TOUR_ANCHORS.podPrint,
      title: 'onboarding.orders-pod-detail.print.title',
      content: 'onboarding.orders-pod-detail.print.content',
    },
    {
      anchor: TOUR_ANCHORS.orderSummary,
      title: 'onboarding.orders-pod-detail.summary.title',
      content: 'onboarding.orders-pod-detail.summary.content',
    },
    {
      // The lines fill the screen, so the tooltip hangs from the summary just above them.
      anchor: TOUR_ANCHORS.orderSummary,
      spotlight: TOUR_ANCHORS.podLines,
      title: 'onboarding.orders-pod-detail.lines.title',
      content: 'onboarding.orders-pod-detail.lines.content',
    },
    {
      anchor: TOUR_ANCHORS.podAccepted,
      spotlight: TOUR_ANCHORS.podLines,
      column: 'orders.pod.accepted',
      title: 'onboarding.orders-pod-detail.accepted.title',
      content: 'onboarding.orders-pod-detail.accepted.content',
      placement: 'inline-start',
    },
    {
      anchor: TOUR_ANCHORS.podDelivery,
      title: 'onboarding.orders-pod-detail.delivery.title',
      content: 'onboarding.orders-pod-detail.delivery.content',
      placement: 'top',
    },
    {
      anchor: TOUR_ANCHORS.podActions,
      title: 'onboarding.orders-pod-detail.actions.title',
      content: 'onboarding.orders-pod-detail.actions.content',
      placement: 'top',
    },
  ],
};

export const ordersTours: readonly Tour[] = [
  ordersViewTour,
  fulfillmentTour,
  shipmentTour,
  podTour,
  podDetailTour,
];
