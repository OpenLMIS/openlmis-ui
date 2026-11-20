import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, Suspense, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatePicker } from '@/components/form/form-fields';
import { TranslatedFormMessages } from '@/components/i18n/translated-form-messages';
import {
  currencySettingsOptions,
  deploymentTimeZoneOptions,
} from '@/features/reference-data/api/queries';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{children}</Suspense>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('useDeploymentTimeZone', () => {
  it('reads the time zone the legacy UI shows dates in, without a token', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { timeZoneId: 'Africa/Blantyre' } });
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(result.current).toBe('Africa/Blantyre'));
    expect(client.get).toHaveBeenCalledWith('/localeSettings', {
      baseURL: '/',
      anonymous: true,
      connectionStatus: false,
      timeout: 10_000,
    });
  });

  it('keeps showing the last time zone it read when the settings cannot be read', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: { timeZoneId: 'Africa/Blantyre' } });
    const first = renderHook(() => useDeploymentTimeZone(), { wrapper });
    await waitFor(() => expect(first.result.current).toBe('Africa/Blantyre'));

    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(client.get).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(client.get).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(queryClient.getQueryState(deploymentTimeZoneOptions().queryKey)?.fetchStatus).toBe(
        'idle',
      ),
    );
    expect(queryClient.getQueryData(deploymentTimeZoneOptions().queryKey)).toEqual({
      zone: 'Africa/Blantyre',
      read: false,
    });
    expect(result.current).toBe('Africa/Blantyre');
  });

  it('shows the zone it read before at once, without waiting for the server', () => {
    localStorage.setItem('openlmis-ui.time-zone', 'Africa/Blantyre');
    vi.mocked(client.get).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    expect(result.current).toBe('Africa/Blantyre');
  });

  it('asks again on the next screen after a failed read rather than keeping the fallback', async () => {
    vi.useFakeTimers({ now: new Date(), toFake: ['Date'] });
    vi.mocked(client.get).mockRejectedValueOnce(new Error('offline'));
    const first = renderHook(() => useDeploymentTimeZone(), { wrapper });
    await waitFor(() => expect(first.result.current).toBe('UTC'));
    first.unmount();
    vi.setSystemTime(Date.now() + 1_100);

    vi.mocked(client.get).mockResolvedValue({ data: { timeZoneId: 'Africa/Blantyre' } });
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(result.current).toBe('Africa/Blantyre'));
  });

  it('falls back to UTC, as legacy does, when it has never read one', async () => {
    vi.mocked(client.get).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDeploymentTimeZone(), { wrapper });

    await waitFor(() => expect(result.current).toBe('UTC'));
  });
});

it('serves the time zone and currency from one locale settings request', async () => {
  const settings = { timeZoneId: 'Africa/Blantyre', currencyCode: 'MWK', currencySymbol: 'K' };
  vi.mocked(client.get).mockResolvedValue({ data: settings });
  await queryClient.fetchQuery(deploymentTimeZoneOptions());
  const options = currencySettingsOptions();
  const currency = await queryClient.fetchQuery(options);
  expect(currency).toMatchObject({ currencyCode: 'MWK', currencySymbol: 'K' });
  expect(client.get).toHaveBeenCalledTimes(1);
});

it('falls back after one failed settings request even when queries retry by default', async () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 2, retryDelay: 0 } },
  });
  vi.mocked(client.get).mockRejectedValue(new Error('server unavailable'));

  expect(await queryClient.fetchQuery(deploymentTimeZoneOptions())).toEqual({
    zone: 'UTC',
    read: false,
  });
  expect(client.get).toHaveBeenCalledTimes(1);
});

function SettingsDate() {
  const [value, setValue] = useState('2024-02-01');
  return (
    <TranslatedFormMessages>
      <DatePicker id="date" label="Date" onValueChange={setValue} value={value} />
      <button type="button">Next</button>
    </TranslatedFormMessages>
  );
}

it('shows the stored date format immediately, keeps it offline and finishes an edit in that format', async () => {
  const user = userEvent.setup();
  localStorage.setItem('openlmis-ui.date-format', 'MM/dd/yyyy');
  vi.mocked(client.get).mockRejectedValueOnce(new Error('offline'));
  render(<SettingsDate />, { wrapper });
  const date = screen.getByRole('textbox', { name: 'Date' });

  expect(date).toHaveValue('02/01/2024');
  await waitFor(() =>
    expect(queryClient.getQueryState(currencySettingsOptions().queryKey)?.status).toBe('error'),
  );
  expect(date).toHaveValue('02/01/2024');
  await user.clear(date);
  await user.type(date, '2/');

  vi.mocked(client.get).mockResolvedValue({
    data: { dateFormat: 'yyyy.MM.dd', timeZoneId: 'UTC' },
  });
  await act(() => queryClient.invalidateQueries({ queryKey: currencySettingsOptions().queryKey }));
  expect(localStorage.getItem('openlmis-ui.date-format')).toBe('yyyy.MM.dd');
  expect(date).toHaveValue('2/');
  await user.type(date, '3/2024');
  expect(date).toHaveValue('2/3/2024');
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(date).toHaveValue('2024.02.03');
});
