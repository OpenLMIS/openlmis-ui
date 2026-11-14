import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import {
  fetchAvailableDashboards,
  fetchReportCategories,
  fetchTemplateReports,
} from '@/features/reports/api/api';
import { ReportCatalog } from '@/features/reports/components/report-catalog';

vi.mock('@/features/reports/api/api', () => ({
  fetchAvailableDashboards: vi.fn(),
  fetchReportCategories: vi.fn(),
  fetchTemplateReports: vi.fn(),
}));

it('keeps usable template links during a dashboard failure and retries only that failed source', async () => {
  vi.mocked(fetchReportCategories).mockResolvedValue([{ id: 'default', name: 'Default Category' }]);
  vi.mocked(fetchTemplateReports).mockResolvedValue([{ id: 'stock', name: 'Stock' }]);
  vi.mocked(fetchAvailableDashboards)
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce([{ id: 'dash', name: 'Dashboard' }]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ReportCatalog userId="user" modules={['common']} />
    </QueryClientProvider>,
  );
  try {
    expect(await screen.findByRole('link', { name: 'Stock' })).toHaveAttribute(
      'href',
      '/#!/reports/list/common/stock/options',
    );
    expect(await screen.findByRole('button', { name: 'error.try-again' })).toBeEnabled();
    expect(screen.queryByText('reports.empty-title')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/#!/reports/list/dashboard/dash',
    );
    expect(screen.getAllByRole('heading', { name: 'Default Category' })).toHaveLength(1);
    expect(fetchTemplateReports).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'error.try-again' })).not.toBeInTheDocument();
  } finally {
    view.unmount();
    queryClient.clear();
  }
});
