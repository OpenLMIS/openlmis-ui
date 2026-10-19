import { z } from 'zod';
import { tableSearchSchema } from '@/lib/table-search';

export const deviceEventsSearchSchema = tableSearchSchema(['occurredDate', 'queuedAt'])
  .pick({ page: true, size: true, sort: true, dir: true })
  .extend({
    event: z.string().min(1).optional().catch(undefined),
    status: z
      .enum(['queued', 'sending', 'uncertain', 'refused', 'accepted'])
      .optional()
      .catch(undefined),
  });
export type DeviceEventsSearch = z.infer<typeof deviceEventsSearchSchema>;
export const CLOSED_DIALOGS = { event: undefined } as const;
