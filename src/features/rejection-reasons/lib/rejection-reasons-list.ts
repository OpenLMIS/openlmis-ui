import type { RejectionReason } from '@/features/reference-data/lib/types';
import {
  DEFAULT_REJECTION_REASONS_SORT,
  type RejectionReasonsListSearch,
} from '@/features/rejection-reasons/lib/search';
import { toPaginationState, toSortingState } from '@/lib/table-search';

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
const COMPARE: Record<string, (a: RejectionReason, b: RejectionReason) => number> = {
  name: (a, b) => byText(a.name, b.name),
  code: (a, b) => byText(a.code, b.code),
  category: (a, b) => byText(a.rejectionReasonCategory.name, b.rejectionReasonCategory.name),
  active: (a, b) => Number(a.active) - Number(b.active),
};

export function pageOfRejectionReasons(
  reasons: readonly RejectionReason[],
  search: RejectionReasonsListSearch,
) {
  const [{ id, desc }] = toSortingState(search, DEFAULT_REJECTION_REASONS_SORT);
  const compare = COMPARE[id] ?? COMPARE.name;
  const term = search.name?.trim().toLocaleLowerCase();
  const sorted = reasons
    .filter((reason) => !term || reason.name.toLocaleLowerCase().includes(term))
    .sort(
      (a, b) =>
        (desc ? -compare(a, b) : compare(a, b)) || byText(a.code, b.code) || byText(a.id, b.id),
    );
  const { pageIndex, pageSize } = toPaginationState(search);
  const totalPages = Math.ceil(sorted.length / pageSize);
  const page = Math.min(pageIndex + 1, Math.max(1, totalPages));
  return {
    content: sorted.slice((page - 1) * pageSize, page * pageSize),
    totalElements: sorted.length,
    totalPages,
    page,
  };
}
