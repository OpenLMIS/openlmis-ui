import type { Tour } from '@/features/onboarding/lib/types';
import { homeTour } from '@/features/onboarding/tours/home.tour';
import { requisitionDetailTour } from '@/features/onboarding/tours/requisition-detail.tour';
import { requisitionsViewTour } from '@/features/onboarding/tours/requisitions-view.tour';

const TOURS: readonly Tour[] = [homeTour, requisitionsViewTour, requisitionDetailTour];

export function tourForRoute(routeId: string | undefined): Tour | undefined {
  return TOURS.find((tour) => tour.routeIds.some((id) => id === routeId));
}
