import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrinterIcon } from 'lucide-react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { usePrintReport } from '@/hooks/use-print-report';
import { downloadFile } from '@/lib/download-file';
import { openReport } from '@/lib/open-report';
import { httpError } from '@/tests/http-error';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/lib/download-file', () => ({ downloadFile: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const USER = 'user1';
const labels = {
  button: 'Print',
  successTitle: 'Ready',
  successDescription: 'Downloaded',
  errorTitle: 'Could Not Print',
  errorDescription: 'Try again',
  refusedDescription: 'No permission',
};
const request = vi.fn<() => Promise<Blob>>();
const tab = { location: { href: 'about:blank' }, close: vi.fn(), closed: false };
const grant = ['STOCK_CARDS_VIEW|f1|p1'];
function ReportButton({ reportAction }: { reportAction: 'download' | 'open' }) {
  const print = usePrintReport({
    userId: USER,
    facilityId: 'f1',
    programId: 'p1',
    right: 'STOCK_CARDS_VIEW',
    request,
    onReport: () =>
      reportAction === 'open'
        ? openReport('card.pdf')
        : {
            deliver: (blob) => downloadFile(blob, 'card.pdf'),
            close: () => {},
          },
    successTitle: labels.successTitle,
    successDescription: labels.successDescription,
    errorTitle: labels.errorTitle,
    errorDescription: labels.errorDescription,
    refusedDescription: labels.refusedDescription,
  });
  return (
    <Button disabled={print.isPending} onClick={print.print}>
      {print.isPending ? <Spinner /> : <PrinterIcon />}
      {labels.button}
    </Button>
  );
}
function renderButton(reportAction: 'download' | 'open' = 'download') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ReportButton reportAction={reportAction} />
    </QueryClientProvider>,
  );
  return queryClient;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  URL.createObjectURL = vi.fn(() => 'blob:report');
  URL.revokeObjectURL = vi.fn();
  tab.location.href = 'about:blank';
  useLoginData.setState({ referenceDataUserId: USER });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(grant);
  request.mockResolvedValue(new Blob(['%PDF']));
});
afterEach(() => useLoginData.setState({ referenceDataUserId: null }));

describe('usePrintReport', () => {
  it('opens card reports for printing after the same scoped permission check', async () => {
    renderButton('open');
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(tab.location.href).toBe('blob:report'));
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('opens the tab before waiting for permissions or the PDF', async () => {
    vi.mocked(fetchPermissionStrings).mockReturnValue(new Promise(() => {}));
    renderButton('open');
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(request).not.toHaveBeenCalled();
  });

  it('downloads with the filename when a tab is blocked', async () => {
    vi.mocked(window.open).mockReturnValue(null);
    renderButton('open');
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledWith(expect.any(Blob), 'card.pdf'));
    expect(toast.success).toHaveBeenCalled();
  });

  it('closes the waiting tab when the request fails', async () => {
    request.mockRejectedValue(httpError(500));
    renderButton('open');
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('closes the tab immediately when the user changes during the request', async () => {
    request.mockReturnValue(new Promise(() => {}));
    renderButton('open');
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(request).toHaveBeenCalled());
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    expect(tab.close).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('keeps a report cancelled when the original user signs back in before it arrives', async () => {
    let release = () => {};
    request.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(new Blob(['%PDF']));
      }),
    );
    renderButton('open');
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(request).toHaveBeenCalled());
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    act(() => useLoginData.setState({ referenceDataUserId: USER }));
    await act(async () => release());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled());
    expect(tab.location.href).toBe('about:blank');
    expect(downloadFile).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('downloads after rechecking the exact grant and reports success', async () => {
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledWith(expect.any(Blob), 'card.pdf'));
    expect(toast.success).toHaveBeenCalledWith('Ready', { description: 'Downloaded' });
  });

  it('does not request a report without the exact grant', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(['STOCK_CARDS_VIEW|f1|other']);
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could Not Print', { description: 'No permission' }),
    );
    expect(request).not.toHaveBeenCalled();
  });

  it.each([403, 500])('handles a report refusal or server error: %i', async (status) => {
    request.mockRejectedValue(httpError(status, { message: 'Server details' }));
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could Not Print', {
        description: status === 500 ? 'Try again' : 'Server details',
      }),
    );
  });

  it('does not request a report if the user changes while permissions are loading', async () => {
    let release = () => {};
    vi.mocked(fetchPermissionStrings).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(grant);
      }),
    );
    renderButton();
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(fetchPermissionStrings).toHaveBeenCalled());
    act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
    await act(async () => release());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled());
    expect(request).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each(['success', 'error'])(
    'drops late %s responses after the user changes',
    async (outcome) => {
      let release = () => {};
      request.mockReturnValue(
        new Promise((resolve, reject) => {
          release = () =>
            outcome === 'success' ? resolve(new Blob(['%PDF'])) : reject(httpError(500));
        }),
      );
      renderButton();
      await userEvent.click(screen.getByRole('button', { name: 'Print' }));
      await waitFor(() => expect(request).toHaveBeenCalled());
      act(() => useLoginData.setState({ referenceDataUserId: 'other' }));
      await act(async () => release());
      await waitFor(() => expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled());
      expect(downloadFile).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    },
  );
});
