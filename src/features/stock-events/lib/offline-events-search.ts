import { z } from 'zod';
import { OFFLINE_EVENT_TYPES } from '@/features/stock-events/lib/event-kinds';
import { dateFilterSchema, tableSearchSchema } from '@/lib/table-search';

export const offlineEventsSearchSchema = tableSearchSchema([
  'occurredDate',
  'queuedAt',
  'failedAt',
  'acceptedAt',
])
  .pick({ page: true, size: true, sort: true, dir: true })
  .extend({
    tab: z.enum(['errors', 'synced']).optional().catch(undefined),
    eventType: z.enum(OFFLINE_EVENT_TYPES).optional().catch(undefined),
    startDate: dateFilterSchema,
    endDate: dateFilterSchema,
    event: z.string().min(1).optional().catch(undefined),
    status: z
      .enum(['queued', 'sending', 'uncertain', 'refused', 'accepted'])
      .optional()
      .catch(undefined),
  });
export type OfflineEventsSearch = z.infer<typeof offlineEventsSearchSchema>;
export const CLOSED_DIALOGS = { event: undefined } as const;

export const CLEARED_EVENT_FILTERS = {
  eventType: undefined,
  startDate: undefined,
  endDate: undefined,
  page: undefined,
  event: undefined,
} as const;
export function activeEventFilters(search: OfflineEventsSearch) {
  return [search.eventType, search.startDate, search.endDate].filter(Boolean).length;
}

export function offlineEventTab(search: OfflineEventsSearch) {
  return (
    search.tab ??
    (search.status === 'accepted'
      ? 'synced'
      : search.status === 'refused' || search.status === 'uncertain'
        ? 'errors'
        : 'pending')
  );
}
