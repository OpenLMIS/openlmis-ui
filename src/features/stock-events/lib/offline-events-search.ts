import { z } from 'zod';
import { tableSearchSchema } from '@/lib/table-search';

export const offlineEventsSearchSchema = tableSearchSchema(['occurredDate', 'queuedAt'])
  .pick({ page: true, size: true, sort: true, dir: true })
  .extend({
    event: z.string().min(1).optional().catch(undefined),
    status: z
      .enum(['queued', 'sending', 'uncertain', 'refused', 'accepted'])
      .optional()
      .catch(undefined),
  });
export type OfflineEventsSearch = z.infer<typeof offlineEventsSearchSchema>;
export const CLOSED_DIALOGS = { event: undefined } as const;
