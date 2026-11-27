import { expect, it } from 'vitest';
import { pageOfDashboardReports } from '@/features/dashboard-reports/lib/reports-list';
import type { ManagedDashboardReport } from '@/features/dashboard-reports/lib/types';

it('breaks category ties by name across page boundaries', () => {
  const report = (name: string, categoryName: string): ManagedDashboardReport => ({
    id: name,
    name,
    category: { id: categoryName, name: categoryName },
    type: 'SUPERSET',
    enabled: false,
    showOnHomePage: false,
  });
  const rows = [report('Zebra', 'First'), report('Alpha', 'First'), report('Apple', 'Second')];
  expect(pageOfDashboardReports(rows, { sort: 'category', size: 1 }, 'en').content).toEqual([
    rows[1],
  ]);
  expect(
    pageOfDashboardReports(rows, { sort: 'category', size: 1, page: 2 }, 'en').content,
  ).toEqual([rows[0]]);
});
