import { afterEach, beforeEach, expect, it } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import type { RequisitionLocalDraft } from '@/features/requisitions/hooks/use-requisition-draft';
import { countUnsyncedRequisitionDrafts } from '@/features/requisitions/lib/unsynced-device-work';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';

const baseHeaders = {
  draftStatusMessage: 'Saved comment',
  datePhysicalStockCountCompleted: '2026-10-27',
};
const localDraft = (
  draftId: string,
): RequisitionLocalDraft & { baseHeaders: typeof baseHeaders } => ({
  draftId,
  userId: 'owner',
  formatVersion: 1,
  modifiedDate: '2026-10-28T10:00:00Z',
  eTag: '"base"',
  baseHeaders,
  draft: { lines: {}, addedLines: [], removedLineIds: [], ...baseHeaders },
});

beforeEach(() => {
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'owner',
    username: 'Owner',
    accessToken: 'token',
  });
});
afterEach(async () => {
  await getLocalDb().delete();
  useLoginData.getState().clearLoginData();
});

it('counts each owned changed requisition once and excludes unchanged and foreign rows', async () => {
  const line = localDraft('line');
  line.draft.lines = { line: { requestedQuantity: '12' } };
  const removed = localDraft('removed');
  removed.draft.removedLineIds = ['removed-line'];
  const added = localDraft('added');
  added.draft.addedLines = [{ id: 'new-line' }] as RequisitionLocalDraft['draft']['addedLines'];
  const cleared = localDraft('cleared');
  cleared.draft.draftStatusMessage = '';
  const date = localDraft('date');
  date.draft.datePhysicalStockCountCompleted = null;
  const foreign = { ...line, draftId: 'foreign', userId: 'other' };
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionDrafts)
    .bulkPut([localDraft('unchanged'), line, removed, added, cleared, date, foreign]);
  expect(await countUnsyncedRequisitionDrafts()).toBe(5);
});

it('uses empty header defaults for older stored rows without a baseline', async () => {
  const { baseHeaders: _, ...legacy } = localDraft('legacy');
  await getLocalDb()
    .table(LOCAL_TABLES.requisitionDrafts)
    .bulkPut([
      legacy,
      {
        ...legacy,
        draftId: 'empty',
        draft: {
          ...legacy.draft,
          draftStatusMessage: '',
          datePhysicalStockCountCompleted: null,
        },
      },
    ]);
  expect(await countUnsyncedRequisitionDrafts()).toBe(1);
});

it('does not open another owners work after logout', async () => {
  await getLocalDb().delete();
  useLoginData.getState().clearLoginData();
  expect(await countUnsyncedRequisitionDrafts()).toBe(0);
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'owner', username: 'owner', accessToken: 'token' });
});
