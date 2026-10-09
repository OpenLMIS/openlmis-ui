import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { usePhysicalInventoryAutosave } from '@/features/stock-events/hooks/use-physical-inventory-autosave';
import {
  type InventoryLocalCopy,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';

vi.mock('@/features/stock-events/lib/physical-inventory-local', () => ({
  writeInventoryLocal: vi.fn(),
}));
const signIn = (id: string) =>
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: id, username: id, accessToken: 'token' });
const copy: InventoryLocalCopy = {
  draftId: 'd',
  programId: 'p',
  facilityId: 'f',
  lines: [],
  modified: true,
  savedAt: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  signIn('autosave-user');
});
it('keeps pending edits serialized and clears the indicator when the copy is cleared', async () => {
  const finish = Promise.withResolvers<void>();
  vi.mocked(writeInventoryLocal).mockReturnValueOnce(finish.promise).mockResolvedValue(undefined);
  const view = renderHook(({ value }) => usePhysicalInventoryAutosave(value), {
    initialProps: { value: null as InventoryLocalCopy | null },
  });
  view.rerender({ value: copy });
  view.rerender({ value: { ...copy, savedAt: 2 } });
  expect(writeInventoryLocal).toHaveBeenCalledTimes(1);
  expect(view.result.current.status).toBe('saving');
  await act(async () => {
    finish.resolve();
    await view.result.current.flush();
  });
  expect(writeInventoryLocal).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(view.result.current.status).toBe('saved'));
  view.rerender({ value: null });
  await waitFor(() => expect(view.result.current.status).toBe('saved'));
});
it('drops queued writes and their completion after a user change', async () => {
  const finish = Promise.withResolvers<void>();
  vi.mocked(writeInventoryLocal).mockReturnValueOnce(finish.promise);
  const view = renderHook(({ value }) => usePhysicalInventoryAutosave(value), {
    initialProps: { value: null as InventoryLocalCopy | null },
  });
  view.rerender({ value: copy });
  view.rerender({ value: { ...copy, savedAt: 2 } });
  signIn('next-user');
  await act(async () => {
    finish.resolve();
    await view.result.current.flush();
  });
  expect(writeInventoryLocal).toHaveBeenCalledTimes(1);
});

it('can reset a failed indicator after a successful server action', async () => {
  vi.mocked(writeInventoryLocal).mockRejectedValue(new Error('full'));
  const view = renderHook(({ value }) => usePhysicalInventoryAutosave(value), {
    initialProps: { value: null as InventoryLocalCopy | null },
  });
  view.rerender({ value: copy });
  await waitFor(() => expect(view.result.current.status).toBe('failed'));
  view.rerender({ value: null });
  act(() => view.result.current.reset());
  expect(view.result.current.status).toBe('saved');
});
