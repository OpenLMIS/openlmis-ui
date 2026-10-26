import { onlineManager } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { stockEventDownloadProviders } from '@/features/stock-events/lib/download-providers';
import { whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { reloadOnce } from '@/lib/chunk-load';
import { deviceAccessReaders, startDeviceWorkServices } from '@/routes/-device-work-provider';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));
vi.mock('@/hooks/use-leave-guard', async (original) => ({
  ...(await original<typeof import('@/hooks/use-leave-guard')>()),
  whenLeaveAllowed: vi.fn(),
}));
vi.mock('@/lib/chunk-load', async (original) => ({
  ...(await original<typeof import('@/lib/chunk-load')>()),
  reloadOnce: vi.fn(() => false),
}));
let stop: (() => void) | undefined;
afterEach(() => stop?.());
it('recovers a failed service import on reconnect and stops both services on unmount', async () => {
  onlineManager.setOnline(false);
  const coordinatorStop = vi.fn();
  const uploaderStop = vi.fn();
  const access = vi.fn();
  const refresh = vi.fn();
  const coordinator = vi.fn(() => ({ stop: coordinatorStop, freshAccess: access, refresh }));
  const uploader = vi.fn(() => uploaderStop);
  const load = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
    .mockResolvedValue([
      { startOfflineCoordinator: coordinator },
      { startStockEventUploader: uploader },
      { stockEventDownloadProviders },
    ]);
  stop = startDeviceWorkServices('sign-in', load);
  await waitFor(() => expect(load).toHaveBeenCalledOnce());
  expect(reloadOnce).not.toHaveBeenCalled();
  onlineManager.setOnline(true);
  await waitFor(() => expect(coordinator).toHaveBeenCalledOnce());
  expect(reloadOnce).not.toHaveBeenCalled();
  expect(whenLeaveAllowed).not.toHaveBeenCalled();
  expect(uploader).toHaveBeenCalledExactlyOnceWith({ access, refresh });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(load).toHaveBeenCalledTimes(2);
  stop();
  expect(coordinatorStop).toHaveBeenCalledOnce();
  expect(uploaderStop).toHaveBeenCalledOnce();
});
it('retries on visibility and ignores an import that settles after unmount', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const coordinator = vi.fn();
  let finish!: (services: unknown) => void;
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error('Temporary failure'))
    .mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  stop = startDeviceWorkServices('boot', load);
  await waitFor(() => expect(load).toHaveBeenCalledOnce());
  document.dispatchEvent(new Event('visibilitychange'));
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  stop();
  finish([{ startOfflineCoordinator: coordinator }, { startStockEventUploader: vi.fn() }]);
  await Promise.resolve();
  expect(coordinator).not.toHaveBeenCalled();
});

it('retries download access timeouts while upload access fails after its first attempt', async () => {
  const failure = new AxiosError('Timed out', AxiosError.ECONNABORTED);
  vi.mocked(fetchPermissionStrings).mockRejectedValue(failure);
  await expect(deviceAccessReaders({}, () => {}, 'upload').permissions('user')).rejects.toBe(
    failure,
  );
  expect(fetchPermissionStrings).toHaveBeenCalledTimes(1);
  vi.mocked(fetchPermissionStrings).mockClear();
  await expect(deviceAccessReaders({}, () => {}, 'download').permissions('user')).rejects.toBe(
    failure,
  );
  expect(fetchPermissionStrings).toHaveBeenCalledTimes(2);
});
