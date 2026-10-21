import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { usePhysicalInventoryAutosave } from '@/features/stock-events/hooks/use-physical-inventory-autosave';
import { usePhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import {
  type InventoryLocalCopy,
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
