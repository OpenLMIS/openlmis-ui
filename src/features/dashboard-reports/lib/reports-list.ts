import {
  type DashboardReportsSearch,
  DEFAULT_DASHBOARD_REPORTS_SORT,
} from '@/features/dashboard-reports/lib/search';
import type { ManagedDashboardReport } from '@/features/dashboard-reports/lib/types';
import { pageLocally, toPaginationState, toSortingState } from '@/lib/table-search';

export function pageOfDashboardReports(
  reports: readonly ManagedDashboardReport[],
  search: DashboardReportsSearch,
  language: string,
) {
  const [sort = DEFAULT_DASHBOARD_REPORTS_SORT] = toSortingState(
    search,
    DEFAULT_DASHBOARD_REPORTS_SORT,
  );
  const { compare } = new Intl.Collator(language, { sensitivity: 'base' });
  const sorted = reports.toSorted((a, b) => {
    const name = compare(a.name, b.name);
    const category = compare(a.category?.name ?? '', b.category?.name ?? '');
    const [first, second] = sort.id === 'category' ? [category, name] : [name, category];
    return (sort.desc ? -first : first) || second;
  });
  const { pageIndex, pageSize } = toPaginationState(search);
  return pageLocally(sorted, pageIndex, pageSize);
}
