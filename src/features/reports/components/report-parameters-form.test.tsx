import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PageVisibility } from '@/components/shared/page-visibility';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchParameterOptions, generateReport } from '@/features/reports/api/api';
import { ReportParametersForm } from '@/features/reports/components/report-parameters-form';
import { downloadFile } from '@/lib/download-file';
import { reportCaughtError } from '@/lib/report-error';
import { httpError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';
import { STOCK_ON_HAND, TIMELINESS } from '@/test-utils/report-templates';

vi.mock('@/features/reports/api/api', async (original) => ({
  ...(await original<typeof import('@/features/reports/api/api')>()),
  fetchParameterOptions: vi.fn(),
  generateReport: vi.fn(),
}));
vi.mock('@/lib/report-error', async (original) => ({
  ...(await original<typeof import('@/lib/report-error')>()),
  reportCaughtError: vi.fn(),
}));
vi.mock('@/lib/download-file', () => ({ downloadFile: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const USER = 'user-1';
const PROGRAMS = [
  { id: 'p1', name: 'Family Planning' },
  { id: 'p2', name: 'Essential Meds' },
];
const tab = { location: { href: 'about:blank' }, close: vi.fn(), closed: false, document: null };
const pdf = () => ({
  blob: new Blob(['%PDF-1.4\n']),
  filename: 'Timeliness_Report.pdf' as string | undefined,
});

beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: USER });
  vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  tab.location.href = 'about:blank';
  URL.createObjectURL = vi.fn(() => 'blob:report');
  URL.revokeObjectURL = vi.fn();
  vi.mocked(fetchParameterOptions).mockImplementation(async (lookup) =>
    lookup.path === '/programs' ? PROGRAMS : [],
  );
});
afterEach(() => useLoginData.setState({ referenceDataUserId: null }));

async function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderPage(<ReportParametersForm template={TIMELINESS} module="requisitions" userId={USER} />, {
    queryClient,
  });
  await screen.findByRole('button', { name: 'reports.generate.submit' });
}

async function choose(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  const input = screen.getByRole('combobox', { name: label });
  await waitFor(() => expect(input).toBeEnabled());
  await user.click(input);
  await user.click(await screen.findByRole('option', { name: option }));
}

it('blocks an empty Generate, then focuses the first invalid field when the dialog closes', async () => {
  const user = userEvent.setup();
  await renderForm();
  await user.click(screen.getByRole('button', { name: 'reports.generate.submit' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('reports.generate.invalid-title');
  expect(generateReport).not.toHaveBeenCalled();
  expect(window.open).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'dialog.close' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Program Name' })).toHaveFocus());
  expect(screen.getAllByText('reports.generate.required')).toHaveLength(2);
});

it('loads periods for the chosen program only, clearing Period and ignoring a late response', async () => {
  const user = userEvent.setup();
  const late = Promise.withResolvers<unknown[]>();
  vi.mocked(fetchParameterOptions).mockImplementation(async (lookup, params) => {
    if (lookup.path === '/programs') return PROGRAMS;
    if (lookup.path !== '/processingPeriods') return [];
    if (params.programId === 'p1') return late.promise;
    return [{ id: 'q2', name: 'February 2026' }];
  });
  await renderForm();
  expect(screen.getByRole('combobox', { name: 'Period Name' })).toBeDisabled();
  await choose(user, 'Program Name', 'Family Planning');
  expect(fetchParameterOptions).toHaveBeenCalledWith(
    expect.objectContaining({ method: 'GET', path: '/processingPeriods' }),
    { programId: 'p1' },
    expect.any(AbortSignal),
  );
  await choose(user, 'Program Name', 'Essential Meds');
  await choose(user, 'Period Name', 'February 2026');
  await act(async () => late.resolve([{ id: 'q1', name: 'January 2026' }]));
  await user.click(screen.getByRole('combobox', { name: 'Period Name' }));
  expect(await screen.findByRole('option', { name: 'February 2026' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'January 2026' })).not.toBeInTheDocument();
  await user.keyboard('{Escape}');
  const [clearProgram] = screen.getAllByRole('button', { name: 'reports.generate.clear-choice' });
  await user.click(clearProgram as HTMLElement);
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Period Name' })).toHaveValue(''),
  );
  expect(screen.getByRole('combobox', { name: 'Period Name' })).toBeDisabled();
});

it('sends one exact request on a double Generate and keeps every value when it fails', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchParameterOptions).mockImplementation(async (lookup) =>
    lookup.path === '/programs'
      ? PROGRAMS
      : lookup.path === '/processingPeriods'
        ? [{ id: 'q1', name: 'January 2026' }]
        : [],
  );
  const failure = Promise.withResolvers<ReturnType<typeof pdf>>();
  vi.mocked(generateReport).mockReturnValue(failure.promise);
  await renderForm();
  await choose(user, 'Program Name', 'Family Planning');
  await choose(user, 'Period Name', 'January 2026');
  const generate = screen.getByRole('button', { name: 'reports.generate.submit' });
  await user.dblClick(generate);
  await waitFor(() => expect(generateReport).toHaveBeenCalledOnce());
  expect(generateReport).toHaveBeenCalledWith(
    'requisitions',
    'timeliness',
    'pdf',
    { program: 'p1', period: 'q1', lang: 'en' },
    expect.any(AbortSignal),
  );
  expect(window.open).toHaveBeenCalledOnce();
  await act(async () =>
    failure.reject(httpError(400, { messageKey: 'report.error.period', message: 'Bad period' })),
  );
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('reports.generate.error-title', {
      description: 'Bad period',
    }),
  );
  expect(tab.close).toHaveBeenCalled();
  expect(screen.getByRole('combobox', { name: 'Program Name' })).toHaveValue('Family Planning');
  expect(screen.getByRole('combobox', { name: 'Period Name' })).toHaveValue('January 2026');
});

it('downloads non-PDF formats without a tab and opens only a verified PDF', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchParameterOptions).mockImplementation(async (lookup) =>
    lookup.path === '/programs'
      ? PROGRAMS
      : lookup.path === '/processingPeriods'
        ? [{ id: 'q1', name: 'January 2026' }]
        : [],
  );
  vi.mocked(generateReport).mockResolvedValue({
    blob: new Blob(['<html><script>steal()</script>']),
    filename: 'Timeliness_Report.html',
  });
  await renderForm();
  await choose(user, 'Program Name', 'Family Planning');
  await choose(user, 'Period Name', 'January 2026');
  await user.click(screen.getByRole('radio', { name: 'HTML' }));
  await user.click(screen.getByRole('button', { name: 'reports.generate.submit' }));
  await waitFor(() => expect(downloadFile).toHaveBeenCalledOnce());
  const [file, name] = vi.mocked(downloadFile).mock.calls[0] ?? [];
  expect(name).toBe('Timeliness_Report.html');
  expect(file?.type).toBe('application/octet-stream');
  expect(window.open).not.toHaveBeenCalled();
  expect(toast.success).toHaveBeenCalledOnce();
});

it('cancels during the request: closes the tab, settles at once and delivers nothing later', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchParameterOptions).mockImplementation(async (lookup) =>
    lookup.path === '/programs'
      ? PROGRAMS
      : lookup.path === '/processingPeriods'
        ? [{ id: 'q1', name: 'January 2026' }]
        : [],
  );
  const stuck = Promise.withResolvers<ReturnType<typeof pdf>>();
  let signal: AbortSignal | undefined;
  vi.mocked(generateReport).mockImplementation((_m, _i, _f, _p, sent) => {
    signal = sent;
    return stuck.promise;
  });
  await renderForm();
  await choose(user, 'Program Name', 'Family Planning');
  await choose(user, 'Period Name', 'January 2026');
  await user.click(screen.getByRole('button', { name: 'reports.generate.submit' }));
  await user.click(await screen.findByRole('button', { name: 'reports.generate.cancel' }));
  expect(tab.close).toHaveBeenCalled();
  expect(signal?.aborted).toBe(true);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'reports.generate.submit' })).toBeEnabled(),
  );
  await act(async () => stuck.resolve(pdf()));
  expect(tab.location.href).toBe('about:blank');
  expect(downloadFile).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});

it('ends a generation when the app hides the page, without delivering or a toast', async () => {
  const user = userEvent.setup();
  vi.mocked(fetchParameterOptions).mockImplementation(async (lookup) =>
    lookup.path === '/programs'
      ? PROGRAMS
      : lookup.path === '/processingPeriods'
        ? [{ id: 'q1', name: 'January 2026' }]
        : [],
  );
  const stuck = Promise.withResolvers<ReturnType<typeof pdf>>();
  let signal: AbortSignal | undefined;
  vi.mocked(generateReport).mockImplementation((_m, _i, _f, _p, sent) => {
    signal = sent;
    return stuck.promise;
  });
  let hide = () => {};
  function Host() {
    const [hidden, setHidden] = useState(false);
    hide = () => setHidden(true);
    return (
      <PageVisibility hidden={hidden}>
        <ReportParametersForm template={TIMELINESS} module="requisitions" userId={USER} />
      </PageVisibility>
    );
  }
  renderPage(<Host />, {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  });
  await screen.findByRole('button', { name: 'reports.generate.submit' });
  await choose(user, 'Program Name', 'Family Planning');
  await choose(user, 'Period Name', 'January 2026');
  await user.click(screen.getByRole('button', { name: 'reports.generate.submit' }));
  await waitFor(() => expect(signal).toBeDefined());
  act(() => hide());
  expect(signal?.aborted).toBe(true);
  expect(tab.close).toHaveBeenCalled();
  await act(async () => stuck.resolve(pdf()));
  expect(tab.location.href).toBe('about:blank');
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});

it.each(['failed', 'loading'])(
  'returns invalid-submit focus to an actionable control when a required lookup is %s',
  async (state) => {
    vi.mocked(fetchParameterOptions).mockImplementation(async (lookup) => {
      if (lookup.path !== '/programs') return [];
      if (state === 'failed') throw httpError(403, 'Refused');
      return new Promise(() => {});
    });
    const user = userEvent.setup();
    await renderForm();
    if (state === 'failed') {
      await screen.findByText('reports.source-refused');
      expect(reportCaughtError).toHaveBeenCalledOnce();
    }
    expect(screen.getByRole('combobox', { name: 'Program Name' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'reports.generate.submit' }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'dialog.close' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: state === 'failed' ? 'error.try-again' : 'reports.generate.submit',
        }),
      ).toHaveFocus(),
    );
    expect(generateReport).not.toHaveBeenCalled();
  },
);

it('blocks a malformed report date and sends the corrected date in ISO format', async () => {
  const user = userEvent.setup();
  vi.mocked(generateReport).mockResolvedValue(pdf());
  renderPage(<ReportParametersForm template={STOCK_ON_HAND} module="common" userId={USER} />, {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  });
  const date = await screen.findByRole('textbox', { name: /^Date/ });
  const generate = screen.getByRole('button', { name: 'reports.generate.submit' });
  await user.type(date, '31/02/2026');
  await user.click(generate);
  expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  expect(date).toHaveAccessibleDescription('form.date-invalid');
  expect(generateReport).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'dialog.close' }));
  await waitFor(() => expect(date).toHaveFocus());
  expect(screen.queryByRole('dialog', { name: 'Date' })).not.toBeInTheDocument();
  await user.clear(date);
  await user.type(date, '28/02/2026');
  await user.click(generate);
  await waitFor(() =>
    expect(generateReport).toHaveBeenCalledWith(
      'common',
      'soh',
      'pdf',
      { date: '2026-02-28', lang: 'en' },
      expect.any(AbortSignal),
    ),
  );
});

it('offers only True and False for an optional boolean and clears either choice with its X button', async () => {
  const user = userEvent.setup();
  renderPage(<ReportParametersForm template={STOCK_ON_HAND} module="common" userId={USER} />, {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  });
  const boolean = await screen.findByRole('combobox', { name: 'Expired Products' });
  await user.click(boolean);
  expect(await screen.findAllByRole('option')).toHaveLength(2);
  expect(
    screen.queryByRole('option', { name: 'reports.generate.not-selected' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'reports.generate.true' }));
  expect(boolean).toHaveValue('reports.generate.true');
  await user.click(screen.getByRole('button', { name: 'reports.generate.clear-choice' }));
  expect(boolean).toHaveValue('');
  await choose(user, 'Expired Products', 'reports.generate.false');
  expect(boolean).toHaveValue('reports.generate.false');
  await user.click(screen.getByRole('button', { name: 'reports.generate.clear-choice' }));
  expect(boolean).toHaveValue('');
});
