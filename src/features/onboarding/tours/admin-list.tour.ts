import { CheckIcon, EllipsisIcon, EyeIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react';
import type { Tour } from '@/features/onboarding/lib/types';
import { TOUR_ANCHORS } from '@/lib/tour-anchors';

const ADMIN_LISTS = [
  'facilities',
  'facility-types',
  'geographic-zones',
  'lots',
  'processing-schedules',
  'products',
  'programs',
  'reasons',
  'rejection-reason-categories',
  'rejection-reasons',
  'requisition-groups',
  'requisition-templates',
  'roles',
  'service-accounts',
  'supervisory-nodes',
  'supply-lines',
  'supply-partners',
  'users',
  'valid-destinations',
  'valid-sources',
] as const;

// One guide for every Administration list; each page plays the steps for the parts it has.
export const adminListTour: Tour = {
  id: 'admin-list',
  routeIds: ADMIN_LISTS.map((slug) => `/(protected)/_protected/administration/${slug}` as const),
  steps: [
    {
      anchor: TOUR_ANCHORS.listSearch,
      title: 'onboarding.admin-list.search.title',
      content: 'onboarding.admin-list.search.content',
    },
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.admin-list.filters.title',
      content: 'onboarding.admin-list.filters.content',
    },
    {
      anchor: TOUR_ANCHORS.listView,
      title: 'onboarding.admin-list.view.title',
      content: 'onboarding.admin-list.view.content',
    },
    {
      anchor: TOUR_ANCHORS.listCreate,
      title: 'onboarding.admin-list.create.title',
      content: 'onboarding.admin-list.create.content',
    },
    {
      anchor: TOUR_ANCHORS.listSort,
      title: 'onboarding.admin-list.sort.title',
      content: 'onboarding.admin-list.sort.content',
    },
    {
      anchor: TOUR_ANCHORS.listFlag,
      title: 'onboarding.admin-list.statuses.title',
      content: 'onboarding.admin-list.statuses.content',
      placement: 'inline-start',
      legend: [
        {
          label: 'onboarding.admin-list.label.active',
          text: 'onboarding.admin-list.legend.active',
          tone: 'success',
          icon: CheckIcon,
        },
        {
          label: 'onboarding.admin-list.label.inactive',
          text: 'onboarding.admin-list.legend.inactive',
          tone: 'destructive',
          icon: XIcon,
        },
      ],
    },
    {
      anchor: TOUR_ANCHORS.listRowActions,
      spotlight: TOUR_ANCHORS.listTable,
      title: 'onboarding.admin-list.actions.title',
      content: 'onboarding.admin-list.actions.content',
      column: 'data-table.actions',
      placement: 'inline-start',
      legend: [
        {
          label: 'onboarding.admin-list.label.edit',
          text: 'onboarding.admin-list.legend.edit',
          tone: 'outline',
          icon: PencilIcon,
        },
        {
          label: 'onboarding.admin-list.label.view',
          text: 'onboarding.admin-list.legend.view',
          tone: 'outline',
          icon: EyeIcon,
        },
        {
          label: 'onboarding.admin-list.label.more',
          text: 'onboarding.admin-list.legend.more',
          tone: 'outline',
          icon: EllipsisIcon,
        },
        {
          label: 'onboarding.admin-list.label.delete',
          text: 'onboarding.admin-list.legend.delete',
          tone: 'destructive',
          icon: Trash2Icon,
        },
      ],
    },
    {
      anchor: TOUR_ANCHORS.listSelect,
      title: 'onboarding.admin-list.select.title',
      content: 'onboarding.admin-list.select.content',
    },
    {
      anchor: TOUR_ANCHORS.listPager,
      title: 'onboarding.admin-list.pager.title',
      content: 'onboarding.admin-list.pager.content',
      placement: 'top',
    },
  ],
};
