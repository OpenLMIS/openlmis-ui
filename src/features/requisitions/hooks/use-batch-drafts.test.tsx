import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { useBatchDrafts } from '@/features/requisitions/hooks/use-batch-drafts';
import fp from '@/features/requisitions/lib/fixtures/batch/retrieveall-fp.json';
import { countUnsyncedBatchDrafts } from '@/features/requisitions/lib/unsynced-device-work';
import { getLocalDb } from '@/integrations/local-db';
import { DraftConflictError } from '@/lib/draft-store';

const security = vi.hoisted(() => ({ secure: true }));
vi.mock('@/lib/secure-context', () => ({
  get isSecureOrigin() {
    return security.secure;
  },
}));
beforeEach(() => {
  security.secure = true;
  sessionStorage.clear();
});
const records = fp.requisitionDtos;
const r = records[0];
const line = r.requisitionLineItems[0];
beforeEach(() =>
  useLoginData.getState().setLoginData({
    referenceDataUserId: crypto.randomUUID(),
    username: 'test',
    accessToken: 'token',
  }),
);
it('persists only changed cells, reloads them and clears only batch work on Revert', async () => {
  const hook = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(hook.result.current.getStatus().status).toBe('saved'));
  act(() => hook.result.current.set(r.id, line.id, '42'));
  await act(() => hook.result.current.flush());
  expect(await getLocalDb().table('requisitionBatchDrafts').get(r.id)).toMatchObject({
    approvedQuantities: { [line.id]: '42' },
    revision: 1,
  });
  expect(await countUnsyncedBatchDrafts()).toBe(1);
  hook.unmount();
  const reload = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(reload.result.current.text(r.id, line)).toBe('42'));
  await getLocalDb().table('requisitionDrafts').put({ draftId: r.id, sentinel: true });
  await act(() => reload.result.current.clear([r.id]));
  expect(await getLocalDb().table('requisitionBatchDrafts').get(r.id)).toBeUndefined();
  expect(await getLocalDb().table('requisitionDrafts').get(r.id)).toMatchObject({ sentinel: true });
  expect(reload.result.current.text(r.id, line)).toBe('0');
});
it('flags outdated baselines and refuses clearing another tab revision', async () => {
  const hook = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(hook.result.current.getStatus().status).toBe('saved'));
  act(() => hook.result.current.set(r.id, line.id, '12'));
  await act(() => hook.result.current.flush());
  const table = getLocalDb().table('requisitionBatchDrafts');
  const stored = await table.get(r.id);
  await table.put({ ...stored, revision: 2, approvedQuantities: { [line.id]: '99' } });
  await expect(hook.result.current.clear([r.id])).rejects.toBeInstanceOf(DraftConflictError);
  await act(() => hook.result.current.resolve());
  expect(hook.result.current.text(r.id, line)).toBe('99');
  hook.unmount();
  const outdated = renderHook(() => useBatchDrafts([{ ...r, modifiedDate: 'new' }]));
  await waitFor(() => expect(outdated.result.current.outdated(r.id)).toBe(true));
  expect((await table.get(r.id)).approvedQuantities[line.id]).toBe('99');
});
it('durably marks uncertain approval even with no edited quantities', async () => {
  const hook = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(hook.result.current.getStatus().status).toBe('saved'));
  await act(() => hook.result.current.mark([r.id], true));
  hook.unmount();
  expect(await countUnsyncedBatchDrafts()).toBe(1);
  const reload = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(reload.result.current.unresolved(r.id)).toBe(true));
  await act(() => reload.result.current.mark([r.id], false));
  expect(await countUnsyncedBatchDrafts()).toBe(0);
});

it('notifies only the changed cell, product and totals in a 10 by 200 batch', async () => {
  const { generateBatch } = await import('@/features/requisitions/lib/fixtures/batch/generate');
  const large = generateBatch();
  const hook = renderHook(() => useBatchDrafts(large));
  await waitFor(() => expect(hook.result.current.getStatus().status).toBe('saved'));
  let changed = 0;
  let unrelated = 0;
  let product = 0;
  let totals = 0;
  hook.result.current.subscribe('requisition-0:line-0-0', () => changed++);
  hook.result.current.subscribe('requisition-1:line-1-0', () => unrelated++);
  hook.result.current.subscribe('product:product-0', () => product++);
  hook.result.current.subscribe('totals', () => totals++);
  act(() => hook.result.current.set('requisition-0', 'line-0-0', '50'));
  await act(() => hook.result.current.flush());
  expect({ changed, unrelated, product, totals }).toEqual({
    changed: 1,
    unrelated: 0,
    product: 1,
    totals: 1,
  });
});

it('keeps HTTP edits and unresolved approvals across refreshes without writing Dexie', async () => {
  security.secure = false;
  const hook = renderHook(({ data }) => useBatchDrafts(data), { initialProps: { data: records } });
  await waitFor(() => expect(hook.result.current.getStatus().status).toBe('saved'));
  act(() => hook.result.current.set(r.id, line.id, '42'));
  await act(() => hook.result.current.mark([r.id], true));
  hook.rerender({ data: [...records] });
  await waitFor(() => expect(hook.result.current.getStatus().status).toBe('saved'));
  expect(hook.result.current.deviceAvailable).toBe(false);
  expect(hook.result.current.text(r.id, line)).toBe('42');
  expect(hook.result.current.unresolved(r.id)).toBe(true);
  expect(await getLocalDb().table('requisitionBatchDrafts').count()).toBe(0);
  await act(() => hook.result.current.mark([r.id], false));
  const refreshed = records.map((record) => ({ ...record, modifiedDate: 'new baseline' }));
  hook.rerender({ data: refreshed });
  await waitFor(() => expect(hook.result.current.ready()).toBe(true));
  expect(hook.result.current.outdated(r.id)).toBe(true);
  hook.rerender({ data: [...refreshed] });
  await waitFor(() => expect(hook.result.current.ready()).toBe(true));
  expect(hook.result.current.outdated(r.id)).toBe(true);
  act(() => hook.result.current.set(r.id, line.id, '99'));
  expect(hook.result.current.text(r.id, line)).toBe('42');
});

it('keeps fields locked after a draft read failure and loads the copy on Retry', async () => {
  const local = await import('@/lib/local-records');
  const read = vi
    .spyOn(local, 'readOwnedRecord')
    .mockRejectedValueOnce(new Error('Storage unavailable'));
  const hook = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(hook.result.current.getStatus().status).toBe('failed'));
  expect(hook.result.current.ready()).toBe(false);
  act(() => hook.result.current.set(r.id, line.id, '12'));
  expect(hook.result.current.text(r.id, line)).toBe('0');
  act(() => hook.result.current.retry());
  await waitFor(() => expect(hook.result.current.ready()).toBe(true));
  expect(hook.result.current.getStatus().status).toBe('saved');
  read.mockRestore();
});

it('increments revisions and removes the row when the original quantity is restored', async () => {
  const hook = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(hook.result.current.ready()).toBe(true));
  act(() => hook.result.current.set(r.id, line.id, '12'));
  await act(() => hook.result.current.flush());
  act(() => hook.result.current.set(r.id, line.id, '24'));
  await act(() => hook.result.current.flush());
  expect(await getLocalDb().table('requisitionBatchDrafts').get(r.id)).toMatchObject({
    revision: 2,
  });
  act(() => hook.result.current.set(r.id, line.id, String(line.approvedQuantity ?? 0)));
  await act(() => hook.result.current.flush());
  expect(await getLocalDb().table('requisitionBatchDrafts').get(r.id)).toBeUndefined();
});
it('ignores edits to unresolved and outdated records', async () => {
  const hook = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(hook.result.current.ready()).toBe(true));
  await act(() => hook.result.current.mark([r.id], true));
  act(() => hook.result.current.set(r.id, line.id, '91'));
  expect(hook.result.current.text(r.id, line)).toBe('0');
  await act(() => hook.result.current.mark([r.id], false));
  act(() => hook.result.current.set(r.id, line.id, '42'));
  await act(() => hook.result.current.flush());
  hook.unmount();
  const stale = renderHook(() => useBatchDrafts([{ ...r, modifiedDate: 'changed' }]));
  await waitFor(() => expect(stale.result.current.outdated(r.id)).toBe(true));
  act(() => stale.result.current.set(r.id, line.id, '99'));
  expect(stale.result.current.text(r.id, line)).toBe('42');
});
it('reloads HTTP approval markers without persisting quantities and clears them on resolution', async () => {
  security.secure = false;
  const hook = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(hook.result.current.ready()).toBe(true));
  act(() => hook.result.current.set(r.id, line.id, '42'));
  await act(() => hook.result.current.mark([r.id], true));
  hook.unmount();
  const reload = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(reload.result.current.unresolved(r.id)).toBe(true));
  expect(reload.result.current.text(r.id, line)).toBe('0');
  await act(() => reload.result.current.mark([r.id], false));
  reload.unmount();
  const resolved = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(resolved.result.current.ready()).toBe(true));
  expect(resolved.result.current.unresolved(r.id)).toBe(false);
});

it('throws a generic error when a failed writer has no error value', async () => {
  const writer = await import('@/lib/draft-writer');
  const create = writer.createDraftWriter;
  const spy = vi.spyOn(writer, 'createDraftWriter').mockImplementation((...args) => ({
    ...create(...args),
    flush: async () => false,
  }));
  const hook = renderHook(() => useBatchDrafts(records));
  await waitFor(() => expect(hook.result.current.ready()).toBe(true));
  await expect(hook.result.current.flush()).rejects.toBeInstanceOf(Error);
  spy.mockRestore();
});
