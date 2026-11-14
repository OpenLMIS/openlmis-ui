import type { CatalogReport, ReportCategory, ReportGroup } from '@/features/reports/lib/types';

export function groupReports(
  categories: readonly ReportCategory[],
  reports: readonly CatalogReport[],
  fallbackName: string,
): ReportGroup[] {
  const groups = new Map<string, ReportGroup>(
    categories.map((category) => [category.id, { ...category, reports: [] }]),
  );
  const fallback = categories.find(({ name }) => name === 'Default Category') ?? {
    id: 'uncategorized',
    name: fallbackName,
  };
  for (const report of reports) {
    const category = report.category ?? fallback;
    let group = groups.get(category.id);
    if (!group) {
      group = { ...category, reports: [] };
      groups.set(category.id, group);
    }
    group.reports.push(report);
  }
  return [...groups.values()].filter(({ reports }) => reports.length > 0);
}

export function reportLegacyHash(report: CatalogReport) {
  const id = encodeURIComponent(report.id);
  return report.kind === 'template'
    ? `#!/reports/list/${encodeURIComponent(report.module)}/${id}/options`
    : `#!/reports/list/dashboard/${id}`;
}
