import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintButton } from '@/components/print-button';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import { downloadFile } from '@/lib/download-file';
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
const grant = ['STOCK_CARDS_VIEW|f1|p1'];
function renderButton() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PrintButton
        userId={USER}
        facilityId="f1"
        programId="p1"
        right="STOCK_CARDS_VIEW"
        request={request}
        filename="card.pdf"
        labels={labels}
      />
    </QueryClientProvider>,
  );
  return queryClient;
}
beforeEach(() => {
  vi.clearAllMocks();
  useLoginData.setState({ referenceDataUserId: USER });
  vi.mocked(fetchPermissionStrings).mockResolvedValue(grant);
  request.mockResolvedValue(new Blob(['%PDF']));
});
afterEach(() => useLoginData.setState({ referenceDataUserId: null }));

describe('PrintButton', () => {
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
