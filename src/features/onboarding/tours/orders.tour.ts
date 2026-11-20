import type { Tour, TourLegendItem, TourStep } from '@/features/onboarding/lib/types';
import { ON_LIST, sortStep, viewSortStep } from '@/features/onboarding/tours/list-steps';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

const STATUS_TONES = {
  creating: 'secondary',
  ordered: 'info',
  fulfilling: 'warning',
  shipped: 'info',
  'in-route': 'info',
  'ready-to-pack': 'warning',
  received: 'success',
  'transfer-failed': 'destructive',
  cancelled: 'secondary',
} as const;
type StatusKey = keyof typeof STATUS_TONES;

/** Status badges drawn as the list draws them, so the step reads true on an empty list too. */
const statusLegend = (statuses: readonly StatusKey[]): TourLegendItem[] =>
  statuses.map((status) => ({
    label: `orders.status.${status}`,
    text: `onboarding.orders-status.${status}`,
    tone: STATUS_TONES[status],
  }));

const statusStep = (column: TourStep['column'], statuses: readonly StatusKey[]): TourStep => ({
  ...ON_LIST,
  column,
  title: 'onboarding.orders-status.title',
  content: 'onboarding.orders-status.content',
  placement: 'inline-start',
  legend: statusLegend(statuses),
});

const ordersViewTour: Tour = {
  id: 'orders-view',
  routeIds: ['/(protected)/_protected/orders/view'],
  steps: [
    {
      anchor: TOUR_ANCHORS.viewOrdersSupplier,
      title: 'onboarding.orders-view.supplier.title',
      content: 'onboarding.orders-view.supplier.content',
    },
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.orders-view.filters.title',
      content: 'onboarding.orders-view.filters.content',
    },
    viewSortStep,
    {
      ...ON_LIST,
      title: 'onboarding.orders-view.results.title',
      content: 'onboarding.orders-view.results.content',
    },
    statusStep('orders.view.columns.status', [
      'creating',
      'ordered',
      'fulfilling',
      'ready-to-pack',
      'shipped',
      'in-route',
      'received',
      'transfer-failed',
      'cancelled',
    ]),
    sortStep,
    {
      ...ON_LIST,
      column: 'orders.view.columns.actions',
      title: 'onboarding.orders-view.actions.title',
      content: 'onboarding.orders-view.actions.content',
      placement: 'inline-start',
    },
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
    viewSortStep,
    {
      ...ON_LIST,
      title: 'onboarding.orders-fulfillment.results.title',
      content: 'onboarding.orders-fulfillment.results.content',
    },
    statusStep('orders.fulfill.columns.status', ['ordered', 'fulfilling']),
    {
      anchor: TOUR_ANCHORS.fulfillStart,
      title: 'onboarding.orders-fulfillment.start.title',
      content: 'onboarding.orders-fulfillment.start.content',
      placement: 'inline-start',
    },
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
      spotlight: TOUR_ANCHORS.orderLines,
      title: 'onboarding.orders-shipment.lines.title',
      content: 'onboarding.orders-shipment.lines.content',
    },
    {
      anchor: TOUR_ANCHORS.shipmentFill,
      spotlight: TOUR_ANCHORS.orderLines,
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
      anchor: TOUR_ANCHORS.orderActions,
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
    viewSortStep,
    {
      ...ON_LIST,
      title: 'onboarding.orders-pod.results.title',
      content: 'onboarding.orders-pod.results.content',
    },
    statusStep('orders.pod.columns.status', [
      'ready-to-pack',
      'shipped',
      'in-route',
      'received',
      'transfer-failed',
    ]),
    sortStep,
    {
      anchor: TOUR_ANCHORS.podManage,
      title: 'onboarding.orders-pod.manage.title',
      content: 'onboarding.orders-pod.manage.content',
      placement: 'inline-start',
    },
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
      spotlight: TOUR_ANCHORS.orderLines,
      title: 'onboarding.orders-pod-detail.lines.title',
      content: 'onboarding.orders-pod-detail.lines.content',
    },
    {
      anchor: TOUR_ANCHORS.podAccepted,
      spotlight: TOUR_ANCHORS.orderLines,
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
      anchor: TOUR_ANCHORS.orderActions,
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
