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
} as const;

export type TourAnchor = (typeof TOUR_ANCHORS)[keyof typeof TOUR_ANCHORS];
