import type { RejectionReason, RejectionReasonCategory } from '@/features/reference-data/lib/types';

export type RejectionReasonCategoryResponse = Omit<RejectionReasonCategory, 'active'> & {
  active: boolean | null;
};

export type RejectionReasonResponse = Omit<
  RejectionReason,
  'active' | 'rejectionReasonCategory'
> & {
  active: boolean | null;
  rejectionReasonCategory: RejectionReasonCategoryResponse;
};

export function normalizeRejectionReasonCategory(
  category: RejectionReasonCategoryResponse,
): RejectionReasonCategory {
  return { ...category, active: category.active ?? false };
}

export function normalizeRejectionReason(reason: RejectionReasonResponse): RejectionReason {
  return {
    ...reason,
    active: reason.active ?? false,
    rejectionReasonCategory: normalizeRejectionReasonCategory(reason.rejectionReasonCategory),
  };
}
