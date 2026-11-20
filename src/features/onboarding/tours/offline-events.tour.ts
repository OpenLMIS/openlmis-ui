import {
  AlertTriangleIcon,
  CircleXIcon,
  ClockIcon,
  CopyIcon,
  EyeIcon,
  HourglassIcon,
  LoaderCircleIcon,
  PauseIcon,
  RotateCwIcon,
  Trash2Icon,
} from 'lucide-react';
import type { Tour } from '@/features/onboarding/lib/types';
import { offlineEventsTab, TOUR_ANCHORS } from '@/lib/tour-anchors';

// The list fills the screen, so its steps hang from the toolbar above it, each on its own tab.
const ON_EVENTS = {
  anchor: TOUR_ANCHORS.listView,
  spotlight: TOUR_ANCHORS.offlineEventsList,
} as const;

export const offlineEventsTour: Tour = {
  id: 'offline-events',
  routeIds: ['/(protected)/_protected/offline-events'],
  steps: [
    {
      anchor: TOUR_ANCHORS.offlineEventsTabs,
      title: 'onboarding.offline-events.tabs.title',
      content: 'onboarding.offline-events.tabs.content',
    },
    {
      anchor: TOUR_ANCHORS.listFilters,
      title: 'onboarding.offline-events.filters.title',
      content: 'onboarding.offline-events.filters.content',
    },
    {
      anchor: TOUR_ANCHORS.listView,
      title: 'onboarding.offline-events.view.title',
      content: 'onboarding.offline-events.view.content',
    },
    {
      ...ON_EVENTS,
      select: offlineEventsTab('pending'),
      title: 'onboarding.offline-events.events.title',
      content: 'onboarding.offline-events.events.content',
    },
    {
      ...ON_EVENTS,
      select: offlineEventsTab('pending'),
      title: 'onboarding.offline-events.actions.title',
      content: 'onboarding.offline-events.actions.content',
      column: 'stock-events.actions',
      placement: 'inline-start',
      legend: [
        {
          label: 'offline-events.review-event',
          text: 'onboarding.offline-events.legend.view',
          tone: 'outline',
          icon: EyeIcon,
        },
        {
          label: 'offline-events.retry-refused',
          text: 'onboarding.offline-events.legend.retry',
          tone: 'outline',
          icon: RotateCwIcon,
        },
        {
          label: 'offline-events.remove',
          text: 'onboarding.offline-events.legend.remove',
          tone: 'destructive',
          icon: Trash2Icon,
        },
        {
          label: 'offline-events.dismiss',
          text: 'onboarding.offline-events.legend.dismiss',
          tone: 'destructive',
          icon: Trash2Icon,
        },
      ],
    },
    {
      ...ON_EVENTS,
      select: offlineEventsTab('pending'),
      title: 'onboarding.offline-events.pending.title',
      content: 'onboarding.offline-events.pending.content',
      column: 'offline-events.status',
      placement: 'inline-start',
      legend: [
        {
          label: 'offline-events.status-queued',
          text: 'onboarding.offline-events.legend.queued',
          tone: 'info',
          icon: ClockIcon,
        },
        {
          label: 'offline-events.status-sending',
          text: 'onboarding.offline-events.legend.sending',
          tone: 'info',
          icon: LoaderCircleIcon,
        },
        {
          label: 'offline-events.state-waiting',
          text: 'onboarding.offline-events.legend.waiting',
          tone: 'warning',
          icon: HourglassIcon,
        },
        {
          label: 'offline-events.state-held',
          text: 'onboarding.offline-events.legend.held',
          tone: 'warning',
          icon: PauseIcon,
        },
      ],
    },
    {
      ...ON_EVENTS,
      select: offlineEventsTab('errors'),
      title: 'onboarding.offline-events.refused.title',
      content: 'onboarding.offline-events.refused.content',
      column: 'offline-events.error-message',
      placement: 'inline-start',
      legend: [
        {
          label: 'offline-events.status-refused',
          text: 'onboarding.offline-events.legend.refused',
          tone: 'destructive',
          icon: CircleXIcon,
        },
        {
          label: 'offline-events.stock-changed',
          text: 'onboarding.offline-events.legend.stock-changed',
          tone: 'destructive',
          icon: CircleXIcon,
        },
        {
          label: 'offline-events.copied',
          text: 'onboarding.offline-events.legend.copied',
          tone: 'warning',
          icon: CopyIcon,
        },
      ],
    },
    {
      ...ON_EVENTS,
      select: offlineEventsTab('errors'),
      title: 'onboarding.offline-events.review.title',
      content: 'onboarding.offline-events.review.content',
      column: 'offline-events.error-message',
      placement: 'inline-start',
      legend: [
        {
          label: 'offline-events.status-uncertain',
          text: 'onboarding.offline-events.legend.uncertain',
          tone: 'warning',
          icon: AlertTriangleIcon,
        },
      ],
    },
    {
      ...ON_EVENTS,
      select: offlineEventsTab('synced'),
      title: 'onboarding.offline-events.synced.title',
      content: 'onboarding.offline-events.synced.content',
    },
  ],
};
