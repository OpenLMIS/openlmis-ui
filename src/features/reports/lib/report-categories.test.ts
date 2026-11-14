import { describe, expect, it } from 'vitest';
import { groupReports, reportLegacyHash } from '@/features/reports/lib/report-categories';
import type { CatalogReport } from '@/features/reports/lib/types';

const reports: CatalogReport[] = [
  {
    id: 'stock',
    name: 'Stock',
    kind: 'template',
    module: 'common',
    category: { id: 'a', name: 'Same' },
  },
  { id: 'rate', name: 'Rate', kind: 'template', module: 'requisitions' },
  { id: 'dash', name: 'Dashboard', kind: 'dashboard', category: { id: 'b', name: 'Same' } },
  {
    id: 'orphan',
    name: 'Orphan',
    kind: 'template',
    module: 'common',
    category: { id: 'missing', name: 'Outside' },
  },
];

describe('report categories', () => {
  it('keeps namesake categories separate, omits empty categories and preserves uncategorized and orphaned reports', () => {
    const groups = groupReports(
      [
        { id: 'empty', name: 'Empty' },
        { id: 'a', name: 'Same' },
        { id: 'default', name: 'Default Category' },
        { id: 'b', name: 'Same' },
      ],
      reports,
      'Other Reports',
    );
    expect(groups.map(({ id, reports }) => [id, reports.map(({ id }) => id)])).toEqual([
      ['a', ['stock']],
      ['default', ['rate']],
      ['b', ['dash']],
      ['missing', ['orphan']],
    ]);
  });
  it('retains every report and its order when the categories service fails or has no default', () => {
    const groups = groupReports([], [reports[1], reports[0], reports[1]], 'Other Reports');
    expect(groups.map(({ name, reports }) => [name, reports.map(({ id }) => id)])).toEqual([
      ['Other Reports', ['rate', 'rate']],
      ['Same', ['stock']],
    ]);
  });
});

it('keeps module identity and selects the proper encoded legacy destination', () => {
  expect(
    reportLegacyHash({ ...reports[0], kind: 'template', id: 'id/a', module: 'local reports' }),
  ).toBe('#!/reports/list/local%20reports/id%2Fa/options');
  expect(reportLegacyHash(reports[2])).toBe('#!/reports/list/dashboard/dash');
});
