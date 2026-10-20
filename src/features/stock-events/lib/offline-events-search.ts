import { z } from 'zod';
import { OFFLINE_EVENT_TYPES } from '@/features/stock-events/lib/event-kinds';
import { dateFilterSchema, tableSearchSchema } from '@/lib/table-search';

export const offlineEventsSearchSchema = tableSearchSchema(['occurredDate', 'queuedAt'])
  .pick({ page: true, size: true, sort: true, dir: true })
  .extend({
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
  status: undefined,
  eventType: undefined,
  startDate: undefined,
  endDate: undefined,
  page: undefined,
  event: undefined,
} as const;
export function activeEventFilters(search: OfflineEventsSearch) {
  return [search.status, search.eventType, search.startDate, search.endDate].filter(Boolean).length;
}
