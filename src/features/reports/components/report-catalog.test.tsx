import { QueryClient } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import {
  fetchAvailableDashboards,
  fetchReportCategories,
  fetchTemplateReports,
} from '@/features/reports/api/api';
import { ReportCatalog } from '@/features/reports/components/report-catalog';
import { reportCaughtError } from '@/lib/report-error';
import { renderPage } from '@/test-utils/render-page';

vi.mock('@/lib/report-error', () => ({ reportCaughtError: vi.fn() }));

vi.mock('@/features/reports/api/api', () => ({
  fetchAvailableDashboards: vi.fn(),
  fetchReportCategories: vi.fn(),
  fetchTemplateReports: vi.fn(),
}));

it('opens dashboard links in the native viewer without a deployment switch', async () => {
  vi.mocked(fetchReportCategories).mockResolvedValue([]);
  vi.mocked(fetchTemplateReports).mockResolvedValue([]);
  vi.mocked(fetchAvailableDashboards).mockResolvedValue([{ id: 'dash', name: 'Dashboard' }]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  renderPage(<ReportCatalog userId="user" modules={['common']} />, { queryClient });
  try {
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/reports/dashboards/dash',
    );
  } finally {
    queryClient.clear();
  }
});

it('links templates to the native form and keeps them usable during a dashboard failure and retries only that failed source', async () => {
  const error = new Error('Unavailable');
  vi.mocked(fetchReportCategories).mockResolvedValue([{ id: 'default', name: 'Default Category' }]);
  vi.mocked(fetchTemplateReports).mockResolvedValue([{ id: 'stock', name: 'Stock' }]);
  vi.mocked(fetchAvailableDashboards)
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce([{ id: 'dash', name: 'Dashboard' }]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  renderPage(<ReportCatalog userId="user" modules={['common']} />, { queryClient });
  try {
    expect(await screen.findByRole('link', { name: 'Stock' })).toHaveAttribute(
      'href',
      '/reports/common/stock/generate',
    );
    expect(screen.getByRole('table', { name: 'Default Category' })).toBeInTheDocument();
    expect(screen.queryByText('reports.legacy-description')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'error.try-again' })).toBeEnabled();
    expect(reportCaughtError).toHaveBeenCalledExactlyOnceWith(error, {});
    expect(screen.queryByText('reports.empty-title')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/reports/dashboards/dash',
    );
    expect(screen.getAllByRole('heading', { name: 'Default Category' })).toHaveLength(1);
    expect(fetchTemplateReports).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'error.try-again' })).not.toBeInTheDocument();
    expect(reportCaughtError).toHaveBeenCalledOnce();
  } finally {
    queryClient.clear();
  }
});

it.each(['report', 'background'])(
  'preserves %s focus when late categories regroup an uncategorized report',
  async (focused) => {
    const categories = Promise.withResolvers<Awaited<ReturnType<typeof fetchReportCategories>>>();
    vi.mocked(fetchReportCategories).mockReturnValue(categories.promise);
    vi.mocked(fetchTemplateReports).mockResolvedValue([
      { id: 'sample', name: 'Sample Requisition Report' },
      { id: 'stock', name: 'Stock On Hand', category: { id: 'stock', name: 'Stock' } },
    ]);
    vi.mocked(fetchAvailableDashboards).mockResolvedValue([]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    renderPage(<ReportCatalog userId="user" modules={['requisitions']} />, { queryClient });
    try {
      const report = await screen.findByRole('link', { name: 'Sample Requisition Report' });
      expect(screen.getByRole('link', { name: 'Stock On Hand' })).toBeInTheDocument();
      act(() => report.focus());
      expect(report).toHaveFocus();
      if (focused === 'background') {
        await userEvent.click(document.body);
        expect(document.body).toHaveFocus();
      }
      await act(async () => categories.resolve([{ id: 'default', name: 'Default Category' }]));
      await screen.findByRole('heading', { name: 'Default Category' });
      expect(
        focused === 'report'
          ? screen.getByRole('link', { name: 'Sample Requisition Report' })
          : document.body,
      ).toHaveFocus();
    } finally {
      queryClient.clear();
    }
  },
);

it('replaces the initial skeleton with usable reports while another source is still loading', async () => {
  const templates = Promise.withResolvers<Awaited<ReturnType<typeof fetchTemplateReports>>>();
  const dashboards = Promise.withResolvers<Awaited<ReturnType<typeof fetchAvailableDashboards>>>();
  vi.mocked(fetchReportCategories).mockResolvedValue([{ id: 'default', name: 'Default Category' }]);
  vi.mocked(fetchTemplateReports).mockReturnValue(templates.promise);
  vi.mocked(fetchAvailableDashboards).mockReturnValue(dashboards.promise);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  renderPage(<ReportCatalog userId="user" modules={['common']} />, { queryClient });
  try {
    expect(await screen.findAllByRole('table', { hidden: true })).toHaveLength(1);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await act(async () => templates.resolve([{ id: 'stock', name: 'Stock' }]));
    expect(await screen.findByRole('link', { name: 'Stock' })).toHaveAttribute(
      'href',
      '/reports/common/stock/generate',
    );
    expect(screen.getAllByRole('table', { hidden: true })).toHaveLength(1);
    expect(screen.queryByText('reports.empty-title')).not.toBeInTheDocument();
    await act(async () => dashboards.resolve([{ id: 'dashboard', name: 'Dashboard' }]));
    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByRole('table', { hidden: true })).toHaveLength(1);
  } finally {
    queryClient.clear();
  }
});
