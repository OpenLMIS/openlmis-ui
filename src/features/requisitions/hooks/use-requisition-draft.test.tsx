import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { useRequisitionDraft } from '@/features/requisitions/hooks/use-requisition-draft';
import { buildRequisitionDraft } from '@/features/requisitions/lib/draft';
import { column, line, record } from '@/features/requisitions/lib/fixtures/builders';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { getLocalDb } from '@/integrations/local-db';
import { DraftConflictError } from '@/lib/draft-store';

const security = vi.hoisted(() => ({ secure: true }));
vi.mock('@/lib/secure-context', () => ({
  get isSecureOrigin() {
    return security.secure;
  },
}));

const signIn = (id: string) =>
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: id, username: id, accessToken: 'token' });
const base = {
  ...record(),
  id: 'r',
  facility: { id: 'f' },
  processingPeriod: { id: 'period' },
  modifiedDate: '2026-10-28T10:00:00Z',
  eTag: '"base"',
} as RequisitionRecord;
const draft = { ...buildRequisitionDraft(base), draftStatusMessage: 'Device comment' };
beforeEach(() => {
  security.secure = true;
  signIn(crypto.randomUUID());
});
async function store(
  modifiedDate = base.modifiedDate,
  userId = useLoginData.getState().referenceDataUserId,
) {
  await getLocalDb().table('requisitionDrafts').put({
    draftId: 'r',
    formatVersion: 1,
    userId,
    draft,
    modifiedDate,
    eTag: '"base"',
    revision: 1,
  });
}
it('loads a matching base and flags an older draft without discarding it', async () => {
  await store();
  const onLoad = vi.fn();
  const hook = renderHook(() => useRequisitionDraft(base, onLoad));
  await waitFor(() => expect(onLoad).toHaveBeenCalledWith(draft));
  expect(hook.result.current.outdated).toBe(false);
  hook.unmount();
  await store('2026-10-27T10:00:00Z');
  const olderLoad = vi.fn();
  const older = renderHook(() => useRequisitionDraft(base, olderLoad));
  await waitFor(() => expect(older.result.current.outdated).toBe(true));
  expect(olderLoad).not.toHaveBeenCalled();
  expect((await getLocalDb().table('requisitionDrafts').get('r')).draft).toEqual(draft);
});
it('never loads another owner, including a row with an incorrect owner', async () => {
  await store();
  const onLoad = vi.fn();
  const { result } = renderHook(() => useRequisitionDraft(base, onLoad));
  await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
  act(() => signIn('next-owner'));
  await waitFor(() => expect(result.current.status.status).toBe('saved'));
  expect(onLoad).toHaveBeenCalledOnce();
  await store(base.modifiedDate, 'foreign-owner');
  const foreign = vi.fn();
  const other = renderHook(() => useRequisitionDraft(base, foreign));
  await waitFor(() => expect(other.result.current.status.status).toBe('saved'));
  expect(foreign).not.toHaveBeenCalled();
});
it('serializes writes and refuses stale writes and clearing a newer revision', async () => {
  const { result } = renderHook(() => useRequisitionDraft(base));
  await waitFor(() => expect(result.current.status.status).toBe('saved'));
  act(() => result.current.write(draft));
  await act(async () => {
    await result.current.flush();
  });
  const stored = await getLocalDb().table('requisitionDrafts').get('r');
  expect(stored).toMatchObject({
    draft,
    revision: 1,
    modifiedDate: base.modifiedDate,
    eTag: base.eTag,
  });
  await getLocalDb()
    .table('requisitionDrafts')
    .put({ ...stored, revision: 2 });
  act(() => result.current.write({ ...draft, draftStatusMessage: 'stale' }));
  await act(async () => {
    await expect(result.current.flush()).rejects.toBeInstanceOf(DraftConflictError);
  });
  await expect(result.current.clear()).rejects.toBeInstanceOf(DraftConflictError);
  expect((await getLocalDb().table('requisitionDrafts').get('r')).revision).toBe(2);
});
it('stops pending autosaves and clears a successful terminal action with a revision check', async () => {
  const { result } = renderHook(() => useRequisitionDraft(base));
  await waitFor(() => expect(result.current.status.status).toBe('saved'));
  act(() => {
    result.current.write(draft);
    result.current.write({ ...draft, draftStatusMessage: 'latest' });
  });
  await act(async () => {
    await result.current.flush();
  });
  expect((await getLocalDb().table('requisitionDrafts').get('r')).draft.draftStatusMessage).toBe(
    'latest',
  );
  await act(async () => {
    await result.current.clear();
  });
  act(() => result.current.write(draft));
  expect(await getLocalDb().table('requisitionDrafts').get('r')).toBeUndefined();
});

it('adopts a successful Sync base while keeping edits queued during the request', async () => {
  const { result } = renderHook(() => useRequisitionDraft(base));
  await waitFor(() => expect(result.current.status.status).toBe('saved'));
  const newer = { ...draft, draftStatusMessage: 'Typed while Sync ran' };
  const synced = { ...base, modifiedDate: '2026-10-28T11:00:00Z', eTag: '"synced"' };
  act(() => {
    result.current.write(draft);
    result.current.write(newer, synced);
    result.current.write({ ...newer, draftStatusMessage: 'Another edit' });
  });
  await act(async () => {
    await result.current.flush();
  });
  expect(result.current.outdated).toBe(false);
  expect(await getLocalDb().table('requisitionDrafts').get('r')).toMatchObject({
    modifiedDate: synced.modifiedDate,
    eTag: synced.eTag,
    draft: { draftStatusMessage: 'Another edit' },
  });
});

it('does not load or write a device draft on plain HTTP', async () => {
  await store();
  security.secure = false;
  const onLoad = vi.fn();
  const { result } = renderHook(() => useRequisitionDraft(base, onLoad));
  await waitFor(() => expect(result.current.status.status).toBe('saved'));
  expect(result.current.deviceAvailable).toBe(false);
  act(() => result.current.write({ ...draft, draftStatusMessage: 'HTTP edit' }));
  await act(async () => {
    await result.current.flush();
  });
  expect(onLoad).not.toHaveBeenCalled();
  expect((await getLocalDb().table('requisitionDrafts').get('r')).draft).toEqual(draft);
});
it('keeps autosaving after Strict Mode replays the mounting effect', async () => {
  const { result } = renderHook(() => useRequisitionDraft(base), { wrapper: StrictMode });
  await waitFor(() => expect(result.current.status.status).toBe('saved'));
  act(() => result.current.write(draft));
  await act(async () => {
    await result.current.flush();
  });
  expect((await getLocalDb().table('requisitionDrafts').get('r')).draft).toEqual(draft);
});

it('preserves an outdated copy until the user explicitly discards it', async () => {
  await store('2026-10-27T10:00:00Z');
  const onLoad = vi.fn();
  const { result } = renderHook(() => useRequisitionDraft(base, onLoad));
  await waitFor(() => expect(result.current.outdated).toBe(true));
  act(() => {
    result.current.write({ ...draft, draftStatusMessage: 'Server form' });
    result.current.write(draft, base);
  });
  await act(async () => {
    await result.current.flush();
  });
  expect((await getLocalDb().table('requisitionDrafts').get('r')).draft).toEqual(draft);
  await act(async () => {
    await result.current.update(base);
  });
  expect(result.current.outdated).toBe(false);
  expect(result.current.status.status).toBe('saved');
  expect(onLoad).toHaveBeenCalledWith(buildRequisitionDraft(base));
  act(() => result.current.write({ ...draft, draftStatusMessage: 'Chosen server base' }));
  await act(async () => {
    await result.current.flush();
  });
  expect(await getLocalDb().table('requisitionDrafts').get('r')).toMatchObject({
    modifiedDate: base.modifiedDate,
    draft: { draftStatusMessage: 'Chosen server base' },
  });
});

it('stores only remaining edits after Sync adopts the saved added line and server calculations', async () => {
  const original = {
    ...base,
    template: {
      columnsMap: {
        requestedQuantity: column('requestedQuantity', 0, { source: 'USER_INPUT' }),
        stockOnHand: column('stockOnHand'),
      },
    },
    requisitionLineItems: [line({ id: 'a', requestedQuantity: 1, stockOnHand: 10 })],
  } as RequisitionRecord;
  const { result } = renderHook(() => useRequisitionDraft(original));
  await waitFor(() => expect(result.current.status.status).toBe('saved'));
  const added = {
    ...line({ id: 'added', requestedQuantity: 3 }),
    approvedProduct: { id: 'approved', versionNumber: 1 },
    orderable: { id: 'p', versionNumber: 1 },
  };
  const pending = {
    ...buildRequisitionDraft(original),
    lines: { a: { requestedQuantity: '7', stockOnHand: 10 } },
    addedLines: [added],
  };
  const response = {
    ...original,
    modifiedDate: 'synced',
    eTag: 'new',
    requisitionLineItems: [
      { ...original.requisitionLineItems[0], requestedQuantity: 5, stockOnHand: 20 },
      added,
    ],
  };
  act(() => result.current.write(pending, response));
  await act(async () => {
    await result.current.flush();
  });
  expect((await getLocalDb().table('requisitionDrafts').get('r')).draft).toMatchObject({
    lines: { a: { requestedQuantity: '7' } },
    addedLines: [],
    removedLineIds: [],
  });
});

it('loads the newer device draft on conflict and resumes autosave', async () => {
  await store();
  const onLoad = vi.fn();
  const { result } = renderHook(() => useRequisitionDraft(base, onLoad));
  await waitFor(() => expect(onLoad).toHaveBeenCalledOnce());
  const latest = { ...draft, draftStatusMessage: 'Other tab' };
  const table = getLocalDb().table('requisitionDrafts');
  await table.put({ ...(await table.get('r')), revision: 2, draft: latest });
  act(() => result.current.write(draft));
  await act(async () => {
    await expect(result.current.flush()).rejects.toBeInstanceOf(DraftConflictError);
  });
  await act(async () => {
    await result.current.resolve();
  });
  expect(result.current.status.status).toBe('saved');
  expect(onLoad).toHaveBeenLastCalledWith(latest);
  act(() => result.current.write({ ...latest, draftStatusMessage: 'Resolved' }));
  await act(async () => {
    await result.current.flush();
  });
  expect(await table.get('r')).toMatchObject({
    revision: 3,
    draft: { draftStatusMessage: 'Resolved' },
  });
});

it('silently adopts the server and deletes an empty outdated row', async () => {
  await store('old');
  const table = getLocalDb().table('requisitionDrafts');
  await table.put({ ...(await table.get('r')), draft: buildRequisitionDraft(base) });
  const onLoad = vi.fn();
  const { result } = renderHook(() => useRequisitionDraft(base, onLoad));
  await waitFor(() => expect(result.current.status.status).toBe('saved'));
  expect(result.current.outdated).toBe(false);
  expect(await table.get('r')).toBeUndefined();
});
it('removes the device row when Sync leaves no local changes', async () => {
  const { result } = renderHook(() => useRequisitionDraft(base));
  await waitFor(() => expect(result.current.status.status).toBe('saved'));
  act(() => result.current.write(draft));
  await act(() => result.current.flush());
  const saved = { ...base, modifiedDate: 'saved', draftStatusMessage: draft.draftStatusMessage };
  act(() => result.current.write(buildRequisitionDraft(saved), saved));
  await act(() => result.current.flush());
  expect(await getLocalDb().table('requisitionDrafts').get('r')).toBeUndefined();
});
