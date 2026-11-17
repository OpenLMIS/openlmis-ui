import type { LiveNavParent } from '@/lib/types';

/** `data-tour` values that onboarding tours point at; screens set them and hold no tour logic. */
export const TOUR_ANCHORS = {
  requisitionsPicker: 'requisitions-picker',
  requisitionsFilters: 'requisitions-filters',
  requisitionsResults: 'requisitions-results',
  requisitionsViewMenu: 'requisitions-view-menu',
  requisitionHeader: 'requisition-header',
  requisitionComments: 'requisition-comments',
  requisitionTabs: 'requisition-tabs',
  requisitionGridToolbar: 'requisition-grid-toolbar',
  requisitionGrid: 'requisition-grid',
  requisitionTotals: 'requisition-totals',
  requisitionActions: 'requisition-actions',
  homeDashboard: 'home-dashboard',
  shellNavigation: 'shell-navigation',
  shellMenuToggle: 'shell-menu-toggle',
  shellSearch: 'shell-search',
  shellAccount: 'shell-account',
  shellStatus: 'shell-status',
  shellGuide: 'shell-guide',
} as const;

/** Anchor of one sidebar menu section, keyed by its navigation title key. */
export const sectionAnchor = (titleKey: LiveNavParent['titleKey']) =>
  `shell-section:${titleKey}` as const;

export type TourAnchor =
  | (typeof TOUR_ANCHORS)[keyof typeof TOUR_ANCHORS]
  | ReturnType<typeof sectionAnchor>;
