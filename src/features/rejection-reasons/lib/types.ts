import type { RejectionReason, RejectionReasonCategory } from '@/features/reference-data/lib/types';

export type RejectionReasonCategoryBody = Omit<RejectionReasonCategory, 'id'> & { id?: string };
export type RejectionReasonBody = Omit<RejectionReason, 'id'> & { id?: string };
