import type { Tour } from '@/features/onboarding/lib/types';
import { viewMenuStep, viewSortStep } from '@/features/onboarding/tours/list-steps';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

const initiateTour: Tour = {
  id: 'requisitions-initiate',
  routeIds: ['/(protected)/_protected/requisitions/initiate'],
  steps: [
    {
      anchor: TOUR_ANCHORS.requisitionsPicker,
      title: 'onboarding.requisitions-initiate.picker.title',
      content: 'onboarding.requisitions-initiate.picker.content',
    },
    {
      anchor: TOUR_ANCHORS.requisitionType,
      title: 'onboarding.requisitions-initiate.type.title',
      content: 'onboarding.requisitions-initiate.type.content',
    },
    {
      anchor: TOUR_ANCHORS.listTable,
      title: 'onboarding.requisitions-initiate.periods.title',
      content: 'onboarding.requisitions-initiate.periods.content',
      placement: 'top',
    },
    {
      anchor: TOUR_ANCHORS.requisitionProceed,
      title: 'onboarding.requisitions-initiate.proceed.title',
      content: 'onboarding.requisitions-initiate.proceed.content',
      placement: 'inline-start',
    },
  ],
};

const approveTour: Tour = {
  id: 'requisitions-approve',
  routeIds: ['/(protected)/_protected/requisitions/approve'],
  steps: [
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.requisitions-approve.filters.title',
      content: 'onboarding.requisitions-approve.filters.content',
    },
    {
      anchor: TOUR_ANCHORS.approvalSort,
      title: 'onboarding.requisitions-approve.sort.title',
      content: 'onboarding.requisitions-approve.sort.content',
    },
    viewSortStep,
    {
      // A tall list leaves no room above it, so the tooltip hangs from View just above it.
      anchor: TOUR_ANCHORS.listView,
      spotlight: TOUR_ANCHORS.listTable,
      title: 'onboarding.requisitions-approve.results.title',
      content: 'onboarding.requisitions-approve.results.content',
    },
    {
      anchor: TOUR_ANCHORS.requisitionOpen,
      title: 'onboarding.requisitions-approve.open.title',
      content: 'onboarding.requisitions-approve.open.content',
      placement: 'inline-start',
    },
    {
      anchor: TOUR_ANCHORS.listSelect,
      title: 'onboarding.requisitions-approve.select.title',
      content: 'onboarding.requisitions-approve.select.content',
    },
  ],
};

const batchTour: Tour = {
  id: 'requisitions-batch',
  routeIds: ['/(protected)/_protected/requisitions/approve_/batch'],
  steps: [
    {
      anchor: TOUR_ANCHORS.batchStatus,
      title: 'onboarding.requisitions-batch.status.title',
      content: 'onboarding.requisitions-batch.status.content',
    },
    {
      anchor: TOUR_ANCHORS.batchRequisition,
      title: 'onboarding.requisitions-batch.requisitions.title',
      content: 'onboarding.requisitions-batch.requisitions.content',
    },
    {
      // The grid fills the screen, so the tooltip hangs from the first requisition's header.
      anchor: TOUR_ANCHORS.batchRequisition,
      spotlight: TOUR_ANCHORS.batchGrid,
      title: 'onboarding.requisitions-batch.products.title',
      content: 'onboarding.requisitions-batch.products.content',
    },
    {
      // On narrow screens the cards replace the grid; the tooltip hangs from the status above them.
      anchor: TOUR_ANCHORS.batchStatus,
      spotlight: TOUR_ANCHORS.listTable,
      title: 'onboarding.requisitions-batch.products.title',
      content: 'onboarding.requisitions-batch.products.content',
    },
    {
      anchor: TOUR_ANCHORS.batchTotals,
      title: 'onboarding.requisitions-batch.totals.title',
      content: 'onboarding.requisitions-batch.totals.content',
      placement: 'inline-start',
    },
    {
      anchor: TOUR_ANCHORS.batchActions,
      title: 'onboarding.requisitions-batch.actions.title',
      content: 'onboarding.requisitions-batch.actions.content',
      placement: 'top',
    },
  ],
};

const convertTour: Tour = {
  id: 'requisitions-convert',
  routeIds: ['/(protected)/_protected/requisitions/convert'],
  steps: [
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.requisitions-convert.filters.title',
      content: 'onboarding.requisitions-convert.filters.content',
    },
    viewMenuStep,
    {
      // A tall list leaves no room above it, so the tooltip hangs from View just above it.
      anchor: TOUR_ANCHORS.listView,
      spotlight: TOUR_ANCHORS.listTable,
      title: 'onboarding.requisitions-convert.results.title',
      content: 'onboarding.requisitions-convert.results.content',
    },
    {
      anchor: TOUR_ANCHORS.convertDepot,
      spotlight: TOUR_ANCHORS.listTable,
      column: 'requisitions.convert.supplying-depot',
      title: 'onboarding.requisitions-convert.depot.title',
      content: 'onboarding.requisitions-convert.depot.content',
      placement: 'inline-start',
    },
    {
      anchor: TOUR_ANCHORS.listSelect,
      title: 'onboarding.requisitions-convert.select.title',
      content: 'onboarding.requisitions-convert.select.content',
    },
  ],
};

const createOrdersTour: Tour = {
  id: 'requisitions-create-orders',
  routeIds: ['/(protected)/_protected/requisitions/create-orders'],
  steps: [
    {
      anchor: TOUR_ANCHORS.orderProgram,
      title: 'onboarding.requisitions-create-orders.program.title',
      content: 'onboarding.requisitions-create-orders.program.content',
    },
    {
      anchor: TOUR_ANCHORS.orderFacilities,
      title: 'onboarding.requisitions-create-orders.facilities.title',
      content: 'onboarding.requisitions-create-orders.facilities.content',
    },
    {
      anchor: TOUR_ANCHORS.orderSupplier,
      title: 'onboarding.requisitions-create-orders.supplier.title',
      content: 'onboarding.requisitions-create-orders.supplier.content',
    },
    {
      anchor: TOUR_ANCHORS.orderCreate,
      title: 'onboarding.requisitions-create-orders.create.title',
      content: 'onboarding.requisitions-create-orders.create.content',
      placement: 'top',
    },
  ],
};

const orderDraftsTour: Tour = {
  id: 'requisitions-order-drafts',
  routeIds: ['/(protected)/_protected/requisitions/create-orders_/$orderIds'],
  steps: [
    {
      anchor: TOUR_ANCHORS.orderTabs,
      title: 'onboarding.requisitions-order-drafts.tabs.title',
      content: 'onboarding.requisitions-order-drafts.tabs.content',
    },
    {
      anchor: TOUR_ANCHORS.orderSummary,
      title: 'onboarding.requisitions-order-drafts.summary.title',
      content: 'onboarding.requisitions-order-drafts.summary.content',
    },
    {
      anchor: TOUR_ANCHORS.orderAdd,
      title: 'onboarding.requisitions-order-drafts.add.title',
      content: 'onboarding.requisitions-order-drafts.add.content',
    },
    {
      anchor: TOUR_ANCHORS.orderUnit,
      title: 'onboarding.requisitions-order-drafts.unit.title',
      content: 'onboarding.requisitions-order-drafts.unit.content',
    },
    {
      // The lines fill the screen, so the tooltip hangs from the product picker just above them.
      anchor: TOUR_ANCHORS.orderAdd,
      spotlight: TOUR_ANCHORS.orderLines,
      title: 'onboarding.requisitions-order-drafts.lines.title',
      content: 'onboarding.requisitions-order-drafts.lines.content',
    },
    {
      anchor: TOUR_ANCHORS.orderActions,
      title: 'onboarding.requisitions-order-drafts.actions.title',
      content: 'onboarding.requisitions-order-drafts.actions.content',
      placement: 'top',
    },
  ],
};

export const requisitionWorkflowTours: readonly Tour[] = [
  initiateTour,
  approveTour,
  batchTour,
  convertTour,
  createOrdersTour,
  orderDraftsTour,
];
