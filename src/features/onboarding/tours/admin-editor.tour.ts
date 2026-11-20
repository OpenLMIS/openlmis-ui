import type { Tour } from '@/features/onboarding/lib/types';
import { searchStep } from '@/features/onboarding/tours/list-steps';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

const ADMIN_EDITORS = [
  'facilities_/new',
  'facilities_/$id',
  'products_/$id/general',
  'products_/$id/programs',
  'products_/$id/facility-types',
  'products_/$id/kit-unpack-list',
  'requisition-templates_/$id',
  'users_/$id/roles',
  'reasons_/new',
  'reasons_/$id',
  'requisition-groups_/new',
  'requisition-groups_/$id',
  'requisition-groups_/$id_/edit',
  'supervisory-nodes_/$id',
  'supply-partners_/$id',
] as const;

// One guide for every Administration editor; each page plays the steps for the parts it has.
const adminEditorTour: Tour = {
  id: 'admin-editor',
  routeIds: ADMIN_EDITORS.map((path) => `/(protected)/_protected/administration/${path}` as const),
  steps: [
    {
      anchor: TOUR_ANCHORS.editorImport,
      title: 'onboarding.admin-editor.import.title',
      content: 'onboarding.admin-editor.import.content',
    },
    {
      anchor: TOUR_ANCHORS.editorFields,
      title: 'onboarding.admin-editor.fields.title',
      content: 'onboarding.admin-editor.fields.content',
      placement: 'top',
    },
    {
      anchor: TOUR_ANCHORS.editorTabs,
      title: 'onboarding.admin-editor.tabs.title',
      content: 'onboarding.admin-editor.tabs.content',
    },
    {
      // A tall form under the tabs leaves no room above it, so the tooltip hangs from the tabs.
      anchor: TOUR_ANCHORS.editorTabs,
      spotlight: TOUR_ANCHORS.editorTabFields,
      title: 'onboarding.admin-editor.fields.title',
      content: 'onboarding.admin-editor.fields.content',
    },
    searchStep,
    {
      anchor: TOUR_ANCHORS.listView,
      title: 'onboarding.admin-list.view.title',
      content: 'onboarding.admin-list.view.content',
    },
    {
      anchor: TOUR_ANCHORS.editorAdd,
      title: 'onboarding.admin-editor.add.title',
      content: 'onboarding.admin-editor.add.content',
    },
    {
      // A tall list leaves no room above it, so the tooltip hangs from Add just above it.
      anchor: TOUR_ANCHORS.editorAdd,
      spotlight: TOUR_ANCHORS.listTable,
      title: 'onboarding.admin-editor.list.title',
      content: 'onboarding.admin-editor.list.content',
    },
    {
      anchor: TOUR_ANCHORS.listRowActions,
      spotlight: TOUR_ANCHORS.listTable,
      column: 'data-table.actions',
      title: 'onboarding.admin-editor.row-actions.title',
      content: 'onboarding.admin-editor.row-actions.content',
      placement: 'inline-start',
    },
    {
      anchor: TOUR_ANCHORS.editorReorder,
      title: 'onboarding.admin-editor.reorder.title',
      content: 'onboarding.admin-editor.reorder.content',
      placement: 'inline-end',
    },
    {
      anchor: TOUR_ANCHORS.editorActions,
      title: 'onboarding.admin-editor.actions.title',
      content: 'onboarding.admin-editor.actions.content',
      placement: 'top',
    },
  ],
};

const adminCsvTour: Tour = {
  id: 'admin-csv',
  routeIds: [
    '/(protected)/_protected/administration/equipment-catalog',
    '/(protected)/_protected/administration/ideal-stock-amounts',
  ],
  steps: [
    {
      anchor: TOUR_ANCHORS.csvInstructions,
      title: 'onboarding.admin-csv.instructions.title',
      content: 'onboarding.admin-csv.instructions.content',
    },
    {
      anchor: TOUR_ANCHORS.csvExport,
      title: 'onboarding.admin-csv.export.title',
      content: 'onboarding.admin-csv.export.content',
    },
    {
      anchor: TOUR_ANCHORS.csvUpload,
      title: 'onboarding.admin-csv.upload.title',
      content: 'onboarding.admin-csv.upload.content',
      placement: 'top',
    },
  ],
};

export const adminEditorTours: readonly Tour[] = [adminEditorTour, adminCsvTour];
