import type { RejectionReasonCategory } from '@/features/reference-data/lib/types';
import {
  type CategoriesListSearch,
  DEFAULT_CATEGORIES_SORT,
} from '@/features/rejection-reasons/lib/search';
import { toPaginationState, toSortingState } from '@/lib/table-search';

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
const COMPARE: Record<string, (a: RejectionReasonCategory, b: RejectionReasonCategory) => number> =
  {
    name: (a, b) => byText(a.name, b.name),
    code: (a, b) => byText(a.code, b.code),
    active: (a, b) => Number(a.active) - Number(b.active),
  };

export function pageOfCategories(
  categories: readonly RejectionReasonCategory[],
  search: CategoriesListSearch,
) {
  const [{ id, desc }] = toSortingState(search, DEFAULT_CATEGORIES_SORT);
  const compare = COMPARE[id] ?? COMPARE.name;
  const term = search.name?.trim().toLocaleLowerCase();
  const sorted = categories
    .filter((category) => !term || category.name.toLocaleLowerCase().includes(term))
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
