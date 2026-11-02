import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { useBatchDrafts } from '@/features/requisitions/hooks/use-batch-drafts';
import fp from '@/features/requisitions/lib/fixtures/batch/retrieveall-fp.json';
import { countUnsyncedBatchDrafts } from '@/features/requisitions/lib/unsynced-device-work';
import { getLocalDb } from '@/integrations/local-db';
import { DraftConflictError } from '@/lib/draft-store';

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
