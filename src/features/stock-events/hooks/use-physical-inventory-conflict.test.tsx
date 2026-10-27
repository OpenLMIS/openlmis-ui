import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { usePhysicalInventoryAutosave } from '@/features/stock-events/hooks/use-physical-inventory-autosave';
import { usePhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import {
  type InventoryLocalCopy,
  inventoryReference,
  readInventoryLocal,
  readInventoryReference,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { DraftConflictError } from '@/lib/draft-store';

const noCopy = () => null;

it.each([false, true])(
  'clears the observed conflicting copy without deleting later edits (changed again: %s)',
  async (changedAgain) => {
    return runConflict(changedAgain);
  },
);

async function runConflict(changedAgain: boolean) {
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'inventory-conflict',
    username: 'Ada',
    accessToken: 'token',
  });
  await getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts).clear();
  const copy: InventoryLocalCopy = {
    draftId: 'draft',
    facilityId: 'home',
    programId: 'one',
    lines: [],
    modified: true,
    savedAt: 1,
  };
  const saved = await writeInventoryLocal(copy);
  if (!saved) throw new Error('Missing saved copy');
  const view = renderHook(() => {
    const form = usePhysicalInventoryForm([], false);
    return usePhysicalInventoryAutosave(noCopy, form, saved.revision);
  });
  const conflicting = await writeInventoryLocal({ ...saved, savedAt: 2 });
  await act(async () => {
    await expect(view.result.current.write({ ...saved, savedAt: 3 })).rejects.toBeInstanceOf(
      DraftConflictError,
    );
  });
  await waitFor(() => expect(view.result.current.status).toBe('conflict'));
  await act(async () => {
    await expect(view.result.current.write({ ...saved, savedAt: 99 })).rejects.toBeInstanceOf(
      DraftConflictError,
    );
  });
  if (changedAgain) {
    if (!conflicting) throw new Error('Missing conflicting copy');
    const newer = await writeInventoryLocal({ ...conflicting, savedAt: 4 });
    await act(async () => {
      await expect(view.result.current.clear(copy.draftId)).rejects.toBeInstanceOf(
        DraftConflictError,
      );
    });
    expect(
      await getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts).get(copy.draftId),
    ).toEqual(newer);
    return;
  }
  await act(async () => {
    await view.result.current.clear(copy.draftId);
  });
  expect(
    await getLocalDb().table(LOCAL_TABLES.physicalInventoryDrafts).get(copy.draftId),
  ).toBeUndefined();
  expect(view.result.current.status).toBe('saved');
}

it.each([true, false])(
  'keeps an offline-readable reference after resolving another generation (fresh reference: %s)',
  async (freshReference) => {
    useLoginData.getState().setLoginData({
      referenceDataUserId: crypto.randomUUID(),
      username: 'Ada',
      accessToken: 'token',
    });
    const copy: InventoryLocalCopy & { fetchedAt: number; generation: string } = {
      draftId: 'draft',
      facilityId: 'home',
      programId: 'one',
      lines: [],
      modified: true,
      savedAt: 1,
      fetchedAt: 1,
      generation: 'G',
      formatVersion: 1,
      baselineKeys: [],
    };
    const reference = inventoryReference(copy, [], []);
    const initial = await writeInventoryLocal(copy, undefined, undefined, reference);
    const view = renderHook(() =>
      usePhysicalInventoryAutosave(noCopy, usePhysicalInventoryForm([], false), initial?.revision),
    );
    await act(async () => {
      await view.result.current.write(copy, reference);
    });
    const stored = await readInventoryLocal(copy.draftId);
    const other = { ...copy, revision: stored?.revision, generation: 'G2' };
    await writeInventoryLocal(other, undefined, undefined, inventoryReference(other, [], []));
    await act(async () => {
      await expect(view.result.current.write(copy)).rejects.toBeInstanceOf(DraftConflictError);
    });
    await act(async () => {
      await view.result.current.keepCounts(copy, freshReference ? reference : undefined);
    });
    const kept = await readInventoryLocal(copy.draftId);
    const generation = 'G';
    expect(kept).toMatchObject({ generation, orphaned: false, modified: true });
    if (!kept) throw new Error('Missing kept counts');
    expect(await readInventoryReference(kept)).toMatchObject({ generation });
  },
);

it.each([false, true])(
  'keeps a modified tab writable after an untouched snapshot (existing copy: %s)',
  async (existing) => {
    useLoginData.getState().setLoginData({
      referenceDataUserId: crypto.randomUUID(),
      username: 'Ada',
      accessToken: 'token',
    });
    const copy: InventoryLocalCopy = {
      draftId: 'draft',
      facilityId: 'home',
      programId: 'one',
      lines: [],
      modified: false,
      savedAt: 1,
      formatVersion: 1,
      baselineKeys: [],
      fetchedAt: 1,
      generation: 'G',
    };
    const reference = inventoryReference(copy, [], []);
    const saved = existing
      ? await writeInventoryLocal(copy, undefined, undefined, reference)
      : undefined;
    const a = renderHook(() =>
      usePhysicalInventoryAutosave(
        noCopy,
        usePhysicalInventoryForm([], false),
        saved?.revision,
        undefined,
        saved,
      ),
    );
    const b = renderHook(() =>
      usePhysicalInventoryAutosave(
        noCopy,
        usePhysicalInventoryForm([], false),
        saved?.revision,
        undefined,
        saved,
      ),
    );
    await act(async () => {
      const refreshed = { ...copy, fetchedAt: 2, generation: 'G2' };
      await b.result.current.write(refreshed, inventoryReference(refreshed, [], []), true);
    });
    await act(async () => {
      await a.result.current.write({ ...copy, modified: true, savedAt: 3 });
    });
    expect(a.result.current.status).toBe('saved');
    const latest = await readInventoryLocal('draft');
    expect(latest).toMatchObject({
      modified: true,
      savedAt: 3,
      generation: existing ? 'G' : 'G2',
      fetchedAt: existing ? 1 : 2,
    });
    if (!latest) throw new Error('Missing saved counts');
    expect(await readInventoryReference(latest)).toBeDefined();
  },
);

it.each([false, true])(
  'keeps counts and their reference together after another tab opens (modified: %s)',
  async (modified) => {
    useLoginData.getState().setLoginData({
      referenceDataUserId: crypto.randomUUID(),
      username: 'Ada',
      accessToken: 'token',
    });
    const { buildInventoryLines } = await import(
      '@/features/stock-events/lib/physical-inventory-lines'
    );
    const lines = buildInventoryLines(
      [
        {
          orderable: { id: 'p', productCode: 'P', fullProductName: 'Product', description: null },
          lot: null,
          stockOnHand: 10,
        },
      ],
      [{ orderableId: 'p', quantity: 7 }],
    );
    const copy: InventoryLocalCopy = {
      draftId: 'draft',
      facilityId: 'home',
      programId: 'one',
      lines,
      modified,
      savedAt: 1,
      formatVersion: 1,
      baselineKeys: ['p'],
      fetchedAt: 1,
      generation: 'G1',
    };
    const reference = inventoryReference(copy, lines, []);
    const saved = await writeInventoryLocal(copy, undefined, undefined, reference);
    const a = renderHook(() =>
      usePhysicalInventoryAutosave(
        noCopy,
        usePhysicalInventoryForm(lines, false),
        saved?.revision,
        undefined,
        saved,
      ),
    );
    await act(async () => {
      await a.result.current.write(copy, reference);
    });
    const current = await readInventoryLocal(copy.draftId);
    const b = renderHook(() =>
      usePhysicalInventoryAutosave(
        noCopy,
        usePhysicalInventoryForm(lines, false),
        current?.revision,
        undefined,
        current,
      ),
    );
    const refreshed = {
      ...copy,
      generation: 'G2',
      fetchedAt: 2,
      lines: lines.map((line) => ({ ...line, stockOnHand: 20 })),
    };
    await act(async () => {
      await b.result.current.write(
        refreshed,
        inventoryReference(refreshed, refreshed.lines, []),
        true,
      );
    });
    const opened = await readInventoryLocal(copy.draftId);
    expect(opened?.revision).toBe(current?.revision);
    await act(async () => {
      await a.result.current.write({ ...copy, modified: true, savedAt: 3 });
    });
    expect(a.result.current.status).toBe('saved');
    const latest = await readInventoryLocal(copy.draftId);
    expect(latest).toMatchObject({ generation: 'G1', fetchedAt: 1 });
    if (!latest) throw new Error('Missing counts');
    expect(latest.lines[0].stockOnHand).toBe(10);
    expect(latest.revision).toBe((opened?.revision ?? 0) + 1);
    expect(await readInventoryReference(latest)).toMatchObject({
      generation: 'G1',
      fetchedAt: 1,
      eligible: [expect.objectContaining({ stockOnHand: 10 })],
    });
    await act(async () => {
      await a.result.current.write({ ...copy, modified: false, savedAt: 4 });
    });
    expect((await readInventoryLocal(copy.draftId))?.revision).toBe((latest.revision ?? 0) + 1);
  },
);

it.each([false, true])(
  'keeps this visit snapshot identity before its reference is ready (previous copy: %s)',
  async (previous) => {
    useLoginData.getState().setLoginData({
      referenceDataUserId: crypto.randomUUID(),
      username: 'Ada',
      accessToken: 'token',
    });
    const other: InventoryLocalCopy = {
      draftId: 'draft',
      facilityId: 'home',
      programId: 'one',
      lines: [],
      modified: true,
      savedAt: 1,
      generation: 'other',
      fetchedAt: 20,
      formatVersion: 1,
      baselineKeys: [],
    };
    const initial = previous
      ? await writeInventoryLocal(
          { ...other, generation: 'previous', fetchedAt: 5 },
          undefined,
          undefined,
          inventoryReference({ ...other, generation: 'previous', fetchedAt: 5 }, [], []),
        )
      : undefined;
    const own = { ...other, generation: 'own', fetchedAt: 10 };
    const view = renderHook(() =>
      usePhysicalInventoryAutosave(
        noCopy,
        usePhysicalInventoryForm([], false),
        initial?.revision ?? 0,
        undefined,
        initial,
      ),
    );
    if (initial)
      await act(async () => {
        await view.result.current.write(initial);
      });
    const stored = await readInventoryLocal(other.draftId);
    await writeInventoryLocal(
      { ...other, revision: stored?.revision },
      undefined,
      undefined,
      inventoryReference(other, [], []),
    );
    await act(async () => {
      await expect(view.result.current.write(own)).rejects.toBeInstanceOf(DraftConflictError);
    });
    await act(async () => {
      await view.result.current.keepCounts(own);
    });
    const kept = await readInventoryLocal(own.draftId);
    expect(kept).toMatchObject({ generation: 'own', fetchedAt: 10 });
    if (!kept) throw new Error('Missing kept counts');
    expect(await readInventoryReference(kept)).toBeUndefined();
    await act(async () => {
      await view.result.current.write({ ...own, savedAt: 3 });
    });
    expect(await readInventoryLocal(own.draftId)).toMatchObject({
      generation: 'own',
      fetchedAt: 10,
    });
  },
);
