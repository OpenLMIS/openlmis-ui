import { z } from 'zod';
import type { RejectionReason } from '@/features/reference-data/lib/types';

export const COMMENTS_MAX = 4000;

export const buqRejectionReasons = (reasons: readonly RejectionReason[]) =>
  reasons
    .filter(
      ({ active, rejectionReasonCategory: category }) =>
        active && category.active && category.name === 'BUQ',
    )
    .map(({ id, name }) => ({ value: id, label: name }));

export const rejectionSchema = z.object({
  rejectionReasons: z.array(z.string()).min(1, 'buq.approve.reject-reasons-required'),
  generalComments: z.string().max(COMMENTS_MAX, 'buq.approve.reject-comments-too-long'),
});

export type RejectionValues = z.infer<typeof rejectionSchema>;
