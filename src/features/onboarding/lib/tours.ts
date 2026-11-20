import type { Tour } from '@/features/onboarding/lib/types';
import { accountTours } from '@/features/onboarding/tours/account.tour';
import { adminEditorTours } from '@/features/onboarding/tours/admin-editor.tour';
import { adminListTour } from '@/features/onboarding/tours/admin-list.tour';
import { cceInventoryTour } from '@/features/onboarding/tours/cce-inventory.tour';
import { homeTour } from '@/features/onboarding/tours/home.tour';
import { offlineEventsTour } from '@/features/onboarding/tours/offline-events.tour';
import { ordersTours } from '@/features/onboarding/tours/orders.tour';
import { physicalInventoryTour } from '@/features/onboarding/tours/physical-inventory.tour';
import { physicalInventoryDraftTour } from '@/features/onboarding/tours/physical-inventory-draft.tour';
import { reportsTours } from '@/features/onboarding/tours/reports.tour';
import { requisitionDetailTour } from '@/features/onboarding/tours/requisition-detail.tour';
import { requisitionWorkflowTours } from '@/features/onboarding/tours/requisition-workflows.tour';
import { requisitionsViewTour } from '@/features/onboarding/tours/requisitions-view.tour';
import { reverseTour } from '@/features/onboarding/tours/reverse.tour';
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
  ...ordersTours,
  adminListTour,
  ...adminEditorTours,
  reverseTour,
  cceInventoryTour,
  ...reportsTours,
  ...accountTours,
];

export function tourForRoute(routeId: string | undefined): Tour | undefined {
  return TOURS.find((tour) => tour.routeIds.some((id) => id === routeId));
}
