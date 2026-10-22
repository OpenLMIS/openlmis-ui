import { act, renderHook, waitFor } from '@testing-library/react';
import { useCallback, useLayoutEffect } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { usePhysicalInventoryAutosave } from '@/features/stock-events/hooks/use-physical-inventory-autosave';
import { usePhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import {
  type InventoryLocalCopy,
  readInventoryLocal,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { DraftConflictError } from '@/lib/draft-store';

vi.mock('@/features/stock-events/lib/physical-inventory-local', () => ({
  writeInventoryLocal: vi.fn(),
  readInventoryLocal: vi.fn(),
}));
const noCopy = () => null;
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
  vi.resetAllMocks();
  vi.mocked(writeInventoryLocal).mockResolvedValue(undefined);
  signIn('autosave-user');
});
it('keeps pending edits serialized and clears the indicator when the copy is cleared', async () => {
  const finish = Promise.withResolvers<void>();
  vi.mocked(writeInventoryLocal).mockReturnValueOnce(finish.promise.then(() => undefined));
  const view = renderHook(
    ({ value }) => {
      const form = usePhysicalInventoryForm([], false);
      const getCopy = useCallback(() => value, [value]);
      return usePhysicalInventoryAutosave(getCopy, form);
    },
    {
      initialProps: { value: null as InventoryLocalCopy | null },
    },
  );
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
it.each(['next-user', 'autosave-user'])(
  'drops queued writes after switching to %s',
  async (nextUser) => {
    const finish = Promise.withResolvers<void>();
    vi.mocked(writeInventoryLocal).mockReturnValueOnce(finish.promise.then(() => undefined));
    const view = renderHook(
      ({ value }) => {
        const form = usePhysicalInventoryForm([], false);
        const getCopy = useCallback(() => value, [value]);
        return usePhysicalInventoryAutosave(getCopy, form);
      },
      {
        initialProps: { value: null as InventoryLocalCopy | null },
      },
    );
    view.rerender({ value: copy });
    view.rerender({ value: { ...copy, savedAt: 2 } });
    act(() => {
      signIn('next-user');
      signIn(nextUser);
    });
    await act(async () => {
      finish.resolve();
      await view.result.current.flush();
    });
    expect(writeInventoryLocal).toHaveBeenCalledTimes(1);
  },
);

it('can reset a failed indicator after a successful server action', async () => {
  vi.mocked(writeInventoryLocal).mockRejectedValue(new Error('full'));
  const view = renderHook(
    ({ value }) => {
      const form = usePhysicalInventoryForm([], false);
      const getCopy = useCallback(() => value, [value]);
      return usePhysicalInventoryAutosave(getCopy, form);
    },
    {
      initialProps: { value: null as InventoryLocalCopy | null },
    },
  );
  view.rerender({ value: copy });
  await waitFor(() => expect(view.result.current.status).toBe('failed'));
  view.rerender({ value: null });
  act(() => view.result.current.reset());
  expect(view.result.current.status).toBe('saved');
});

it('reports a failed commit to callers while retaining the device failure status', async () => {
  vi.mocked(writeInventoryLocal).mockRejectedValue(new Error('full'));
  const view = renderHook(() => {
    const form = usePhysicalInventoryForm([], false);
    return usePhysicalInventoryAutosave(noCopy, form);
  });
  await act(async () => {
    await expect(view.result.current.write(copy)).rejects.toThrow();
  });
  expect(view.result.current.status).toBe('failed');
  await expect(view.result.current.flush()).rejects.toThrow();
});

it('shares one revision chain between the open snapshot, edits and a saved baseline', async () => {
  const commit = Promise.withResolvers<void>();
  vi.mocked(writeInventoryLocal)
    .mockImplementation(async (value) => ({
      ...value,
      revision: (value.revision ?? 0) + 1,
    }))
    .mockImplementationOnce(async (value) => {
      await commit.promise;
      return { ...value, revision: 1 };
    });
  const view = renderHook(() => {
    const form = usePhysicalInventoryForm([], false);
    return usePhysicalInventoryAutosave(noCopy, form);
  });
  const opened = {
    ...copy,
    modified: false,
    fetchedAt: 12,
    generation: 'open',
    baselineKeys: ['one'],
  };
  const reference = {
    ...opened,
    userId: 'autosave-user',
    formatVersion: 1,
    eligible: [],
    reasons: [],
  };
  let opening!: Promise<void>;
  let editing!: Promise<void>;
  act(() => {
    opening = view.result.current.write(opened, reference);
  });
  expect(view.result.current.status).toBe('saved');
  act(() => {
    editing = view.result.current.write({ ...opened, modified: true });
  });
  expect(view.result.current.status).toBe('saving');
  expect(writeInventoryLocal).toHaveBeenCalledTimes(1);
  await act(async () => {
    commit.resolve();
    await Promise.all([opening, editing]);
  });
  await act(async () => {
    await view.result.current.write({ ...copy, modified: false, baselineKeys: ['saved'] });
  });
  expect(vi.mocked(writeInventoryLocal).mock.calls.map(([value]) => value.revision)).toEqual([
    undefined,
    1,
    2,
  ]);
  expect(vi.mocked(writeInventoryLocal).mock.calls[0][3]).toBe(reference);
  expect(vi.mocked(writeInventoryLocal).mock.calls[1]).toHaveLength(3);
  expect(vi.mocked(writeInventoryLocal).mock.calls[2][0]).toMatchObject({
    modified: false,
    baselineKeys: ['saved'],
    fetchedAt: 12,
    generation: 'open',
  });
});

it('silently adopts a newer revision in an untouched tab, then writes from that revision', async () => {
  const newer = { ...copy, revision: 4, generation: 'G2', fetchedAt: 2 };
  vi.mocked(writeInventoryLocal)
    .mockRejectedValueOnce(new DraftConflictError(newer))
    .mockImplementation(async (value) => ({ ...value, revision: (value.revision ?? 0) + 1 }));
  const adopt = vi.fn();
  const view = renderHook(() => {
    const form = usePhysicalInventoryForm([], false);
    return usePhysicalInventoryAutosave(noCopy, form, 1, adopt);
  });
  await act(async () => {
    await view.result.current.write({ ...copy, modified: false });
  });
  expect(adopt).toHaveBeenCalledWith(newer);
  expect(view.result.current.status).toBe('saved');
  await act(async () => {
    await view.result.current.write(copy);
  });
  expect(vi.mocked(writeInventoryLocal).mock.calls[1][0]).toMatchObject({
    revision: 4,
    generation: 'G2',
    fetchedAt: 2,
  });
});

it('checks the observed revision for Load Latest and Keep My Counts', async () => {
  const newer = { ...copy, revision: 4 };
  const changedAgain = { ...copy, revision: 5 };
  vi.mocked(writeInventoryLocal).mockRejectedValueOnce(new DraftConflictError(newer));
  vi.mocked(readInventoryLocal)
    .mockResolvedValueOnce(changedAgain)
    .mockResolvedValueOnce(changedAgain);
  const adopt = vi.fn();
  const view = renderHook(() => {
    const form = usePhysicalInventoryForm([], false);
    return usePhysicalInventoryAutosave(noCopy, form, 1, adopt);
  });
  await act(async () => {
    await expect(view.result.current.write(copy)).rejects.toBeInstanceOf(DraftConflictError);
  });
  await act(async () => {
    await expect(view.result.current.loadLatest()).rejects.toBeInstanceOf(DraftConflictError);
  });
  expect(adopt).not.toHaveBeenCalled();
  await act(async () => {
    await view.result.current.loadLatest();
  });
  expect(adopt).toHaveBeenCalledWith(changedAgain);
  vi.mocked(writeInventoryLocal).mockImplementation(async (value) => ({
    ...value,
    revision: (value.revision ?? 0) + 1,
  }));
  await act(async () => {
    await view.result.current.keepCounts(copy);
  });
  expect(vi.mocked(writeInventoryLocal).mock.lastCall?.[0]).toMatchObject({
    modified: true,
    revision: 5,
  });
  expect(view.result.current.status).toBe('saved');
});

it.each([undefined, { ...copy, revision: 4, orphaned: true }])(
  'can keep counts after the stored copy is removed or orphaned: %s',
  async (stored) => {
    vi.mocked(writeInventoryLocal).mockRejectedValueOnce(new DraftConflictError(stored));
    const view = renderHook(() =>
      usePhysicalInventoryAutosave(noCopy, usePhysicalInventoryForm([], false), 1),
    );
    await act(async () => {
      await expect(view.result.current.write(copy)).rejects.toBeInstanceOf(DraftConflictError);
    });
    await act(async () => {
      await view.result.current.keepCounts(copy);
    });
    expect(vi.mocked(writeInventoryLocal).mock.lastCall?.[0].revision).toBe(stored?.revision ?? 0);
    expect(view.result.current.status).toBe('saved');
  },
);
it.each([undefined, { ...copy, revision: 4 }])(
  'loads the server baseline when the conflicting device copy was deleted: %s',
  async (stored) => {
    vi.mocked(writeInventoryLocal).mockRejectedValueOnce(new DraftConflictError(stored));
    const adopt = vi.fn();
    const view = renderHook(() =>
      usePhysicalInventoryAutosave(noCopy, usePhysicalInventoryForm([], false), 1, adopt),
    );
    await act(async () => {
      await expect(view.result.current.write(copy)).rejects.toThrow();
    });
    await act(async () => {
      await view.result.current.loadLatest();
    });
    expect(adopt).toHaveBeenCalledWith(undefined);
  },
);
it('rewrites the reference after keeping counts over another generation', async () => {
  const opened = { ...copy, fetchedAt: 12, generation: 'G' };
  const reference = {
    ...opened,
    userId: 'autosave-user',
    formatVersion: 1,
    eligible: [],
    reasons: [],
  };
  vi.mocked(writeInventoryLocal)
    .mockResolvedValueOnce({ ...opened, revision: 1 })
    .mockRejectedValueOnce(new DraftConflictError({ ...opened, generation: 'G2', revision: 2 }));
  const view = renderHook(() =>
    usePhysicalInventoryAutosave(noCopy, usePhysicalInventoryForm([], false)),
  );
  await act(async () => {
    await view.result.current.write(opened, reference);
  });
  await act(async () => {
    await expect(view.result.current.write(opened)).rejects.toThrow();
  });
  await act(async () => {
    await view.result.current.keepCounts(opened, reference);
  });
  expect(vi.mocked(writeInventoryLocal).mock.lastCall?.[3]).toEqual(reference);
});

it('does not keep orphan recovery enabled after a failed Keep My Counts write', async () => {
  vi.mocked(writeInventoryLocal)
    .mockRejectedValueOnce(new DraftConflictError({ ...copy, revision: 2, orphaned: true }))
    .mockRejectedValueOnce(new Error('Full'));
  const view = renderHook(() =>
    usePhysicalInventoryAutosave(noCopy, usePhysicalInventoryForm([], false), 1),
  );
  await act(async () => {
    await expect(view.result.current.write(copy)).rejects.toThrow();
  });
  await act(async () => {
    await expect(view.result.current.keepCounts(copy)).rejects.toThrow();
  });
  await act(async () => {
    await view.result.current.write(copy);
  });
  expect(vi.mocked(writeInventoryLocal).mock.lastCall).toHaveLength(3);
});
it('stages changed modified copies before layout effects observe leave protection', () => {
  const observed = vi.fn();
  vi.mocked(writeInventoryLocal).mockReturnValue(new Promise(() => {}));
  const view = renderHook(
    ({ value }) => {
      const form = usePhysicalInventoryForm([], false);
      const getCopy = useCallback(() => value, [value]);
      const result = usePhysicalInventoryAutosave(getCopy, form);
      useLayoutEffect(() => {
        observed(result.status);
      });
      return result;
    },
    { initialProps: { value: null as InventoryLocalCopy | null } },
  );
  observed.mockClear();
  view.rerender({ value: copy });
  expect(observed.mock.calls.every(([status]) => status === 'saving')).toBe(true);
});

it('keeps the stored snapshot identity when an offline-opened draft is saved after reconnect', async () => {
  const opened = { ...copy, fetchedAt: 123, generation: 'device', revision: 3 };
  const view = renderHook(() =>
    usePhysicalInventoryAutosave(
      noCopy,
      usePhysicalInventoryForm([], false),
      opened.revision,
      undefined,
      opened,
    ),
  );
  await act(async () => {
    await view.result.current.write({ ...copy, modified: false });
  });
  expect(vi.mocked(writeInventoryLocal).mock.lastCall?.[0]).toMatchObject({
    fetchedAt: 123,
    generation: 'device',
    revision: 3,
    modified: false,
  });
});
