import { render, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { DeviceWorkProvider } from '@/routes/-device-work-provider';

const state = vi.hoisted(() => ({ events: [] as DeviceEvent[], hasDeviceEvents: true }));
vi.mock('@/features/stock-events/hooks/use-device-events', () => ({
  useDeviceEvents: () => state,
}));
vi.mock('@/lib/offline-coordinator', () => ({ startOfflineCoordinator: () => () => {} }));
vi.mock('@/features/stock-events/lib/stock-event-uploader', () => ({
  startStockEventUploader: () => () => {},
}));

it('polls foreground locks only while a queued or sending event exists', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'polling-user', username: 'User', accessToken: 'token' });
  const query = vi.fn(async () => ({ held: [], pending: [] }));
  vi.stubGlobal('navigator', { locks: { query } });
  const intervals = vi.spyOn(globalThis, 'setInterval');
  const cleared = vi.spyOn(globalThis, 'clearInterval');
  const setStatus = (status: DeviceEvent['status']) => {
    state.events = [{ localEventId: 'event', status } as DeviceEvent];
  };
  setStatus('accepted');
  const page = () => <DeviceWorkProvider initialTrigger="boot">Content</DeviceWorkProvider>;
  const view = render(page());
  try {
    expect(query).not.toHaveBeenCalled();
    expect(intervals.mock.calls.filter(([, delay]) => delay === 1000)).toHaveLength(0);
    setStatus('queued');
    view.rerender(page());
    await waitFor(() => expect(query).toHaveBeenCalledOnce());
    const index = intervals.mock.calls.findIndex(([, delay]) => delay === 1000);
    expect(index).toBeGreaterThanOrEqual(0);
    const timer = intervals.mock.results[index].value;
    setStatus('sending');
    view.rerender(page());
    expect(cleared).not.toHaveBeenCalledWith(timer);
    setStatus('uncertain');
    view.rerender(page());
    expect(cleared).toHaveBeenCalledWith(timer);
    setStatus('accepted');
    view.rerender(page());
    expect(intervals.mock.calls.filter(([, delay]) => delay === 1000)).toHaveLength(1);
  } finally {
    view.unmount();
    useLoginData.getState().clearLoginData();
    vi.unstubAllGlobals();
  }
});
