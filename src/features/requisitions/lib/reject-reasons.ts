import type { RejectionReason, RejectionReasonCategory } from '@/features/reference-data/lib/types';

export function availableRejectReasons(
  reasons: readonly RejectionReason[],
  categories: readonly RejectionReasonCategory[],
  selected: readonly RejectionReason[],
) {
  const active = new Set(categories.filter((category) => category.active).map(({ id }) => id));
  const picked = new Set(selected.map(({ id }) => id));
  return reasons
    .filter(
      (reason) =>
        reason.active && active.has(reason.rejectionReasonCategory.id) && !picked.has(reason.id),
    )
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

export function availableRejectCategories(
  categories: readonly RejectionReasonCategory[],
  available: readonly RejectionReason[],
) {
  const ids = new Set(available.map((reason) => reason.rejectionReasonCategory.id));
  return categories
    .filter((category) => category.active && ids.has(category.id))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}
