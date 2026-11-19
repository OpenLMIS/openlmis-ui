import type { Tour } from '@/features/onboarding/lib/types';
import { adminListTour } from '@/features/onboarding/tours/admin-list.tour';
import { homeTour } from '@/features/onboarding/tours/home.tour';
import { offlineEventsTour } from '@/features/onboarding/tours/offline-events.tour';
import { physicalInventoryTour } from '@/features/onboarding/tours/physical-inventory.tour';
import { physicalInventoryDraftTour } from '@/features/onboarding/tours/physical-inventory-draft.tour';
import { requisitionDetailTour } from '@/features/onboarding/tours/requisition-detail.tour';
import { requisitionWorkflowTours } from '@/features/onboarding/tours/requisition-workflows.tour';
import { requisitionsViewTour } from '@/features/onboarding/tours/requisitions-view.tour';
import { stockCardTour } from '@/features/onboarding/tours/stock-card.tour';
import { stockEventTours } from '@/features/onboarding/tours/stock-events.tour';
import { stockOnHandTour } from '@/features/onboarding/tours/stock-on-hand.tour';
import { transactionDetailsTour } from '@/features/onboarding/tours/transaction-details.tour';
import { transactionHistoryTour } from '@/features/onboarding/tours/transaction-history.tour';

const TOURS: readonly Tour[] = [
  homeTour,
  requisitionsViewTour,
  requisitionDetailTour,
  ...requisitionWorkflowTours,
  stockOnHandTour,
  stockCardTour,
  transactionHistoryTour,
  transactionDetailsTour,
  physicalInventoryTour,
  physicalInventoryDraftTour,
  ...stockEventTours,
  offlineEventsTour,
  adminListTour,
];

export function tourForRoute(routeId: string | undefined): Tour | undefined {
  return TOURS.find((tour) => tour.routeIds.some((id) => id === routeId));
}
