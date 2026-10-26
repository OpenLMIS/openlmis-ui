import { onlineManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useSnapshotNotice } from '@/components/offline-alert';

it('settles the pinned inventory snapshot notice after reconnect without refetching', () => {
  onlineManager.setOnline(false);
  const view = renderHook(() => useSnapshotNotice(true, false));
  expect(view.result.current).toBe(false);
  act(() => onlineManager.setOnline(true));
  expect(view.result.current).toBe(true);
});

it('keeps a refetching snapshot offline until the query settles after reconnect', () => {
  onlineManager.setOnline(false);
  const view = renderHook(
    ({ refreshing, updatedAt }) => useSnapshotNotice(true, refreshing, updatedAt),
    { initialProps: { refreshing: false, updatedAt: 1 } },
  );
  act(() => onlineManager.setOnline(true));
  expect(view.result.current).toBe(false);
  view.rerender({ refreshing: true, updatedAt: 1 });
  expect(view.result.current).toBe(false);
  view.rerender({ refreshing: false, updatedAt: 2 });
  expect(view.result.current).toBe(true);
});
