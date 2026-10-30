import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildRequisitionDraft,
  type RequisitionDraft,
  rebaseRequisitionDraft,
} from '@/features/requisitions/lib/draft';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { hasUnsyncedRequisitionDraft } from '@/features/requisitions/lib/unsynced-device-work';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { DraftConflictError, saveRevisionedDraft } from '@/lib/draft-store';
import { createDraftWriter, type DraftSaveState } from '@/lib/draft-writer';
import { readOwnedRecord } from '@/lib/local-records';
import { isSecureOrigin } from '@/lib/secure-context';
import {
  assertSessionScope,
  getSessionScope,
  getSessionUserId,
  useSessionScope,
} from '@/lib/session-scope';

export type RequisitionLocalDraft = {
  draftId: string;
  userId: string;
  formatVersion: number;
  revision?: number;
  draft: RequisitionDraft;
  modifiedDate: RequisitionRecord['modifiedDate'];
  eTag: RequisitionRecord['eTag'];
  baseHeaders?: Pick<RequisitionDraft, 'draftStatusMessage' | 'datePhysicalStockCountCompleted'>;
};

export function useRequisitionDraft(
  record: RequisitionRecord,
  onLoad?: (draft: RequisitionDraft) => void,
) {
  const scope = useSessionScope();
  const draftId = record.id;
  const initial = useRef(record);
  if (initial.current.id !== draftId) initial.current = record;
  const adopt = useRef(onLoad);
  adopt.current = onLoad;
  const [, setVersion] = useState(0);
  const controller = useMemo(() => {
    let baseline = initial.current;
    const userId = isSecureOrigin ? getSessionUserId() : null;
    const db = userId ? getLocalDb() : undefined;
    const table = db?.table<RequisitionLocalDraft, string>(LOCAL_TABLES.requisitionDrafts);
    let expected: RequisitionLocalDraft | undefined;
    let pendingBase: RequisitionRecord | undefined;
    let active = false;
    let closed = false;
    let outdated = false;
    let status: DraftSaveState = { status: db ? 'loading' : 'saved' };
    const listeners = new Set<() => void>();
    let publishedStatus = status;
    let publishedLoading = status.status === 'loading';
    let publishedOutdated = outdated;
    const publish = () => {
      if (!active || scope !== getSessionScope()) return;
      const loading = status.status === 'loading';
      if (loading !== publishedLoading || outdated !== publishedOutdated) {
        publishedLoading = loading;
        publishedOutdated = outdated;
        setVersion((version) => version + 1);
      }
      if (status.status !== publishedStatus.status || status.error !== publishedStatus.error) {
        publishedStatus = status;
        for (const listener of listeners) listener();
      }
    };
    const readStored = () =>
      db
        ? readOwnedRecord<RequisitionLocalDraft>(LOCAL_TABLES.requisitionDrafts, draftId, {
            formats: [1],
          })
        : Promise.resolve(undefined);
    const removeStored = async () => {
      if (!db || !table) return;
      await saveRevisionedDraft({
        db,
        table,
        sessionScope: scope,
        expected,
        read: () => table.get(draftId),
        next: () => undefined,
      });
      assertSessionScope(scope);
    };
    let loaded: Promise<void> | undefined;
    const load = () => {
      loaded ??= readStored().then(async (stored) => {
        assertSessionScope(scope);
        expected = stored;
        if (
          stored &&
          db &&
          table &&
          (!hasUnsyncedRequisitionDraft(stored) ||
            JSON.stringify(rebaseRequisitionDraft(baseline, stored.draft)) ===
              JSON.stringify(buildRequisitionDraft(baseline)))
        ) {
          await removeStored();
          expected = undefined;
          stored = undefined;
        }
        outdated = !!stored && stored.modifiedDate !== baseline.modifiedDate;
        if (active && stored && !outdated)
          adopt.current?.(rebaseRequisitionDraft(baseline, stored.draft));
        status = { status: 'saved' };
        publish();
      });
      return loaded;
    };
    const writer = createDraftWriter<{ draft: RequisitionDraft; base?: RequisitionRecord }>(
      async ({ draft, base }) => {
        await load();
        assertSessionScope(scope);
        if (!db || !table || !userId || !active) return;
        if (outdated) return;
        expected = await saveRevisionedDraft({
          db,
          table,
          sessionScope: scope,
          expected,
          read: () => table.get(draftId),
          next: (stored) => {
            const currentBase = base ?? baseline;
            const rebased = rebaseRequisitionDraft(currentBase, draft);
            const headers = buildRequisitionDraft(currentBase);
            if (JSON.stringify(rebased) === JSON.stringify(headers)) return undefined;
            return {
              draftId,
              userId,
              formatVersion: 1,
              revision: (stored?.revision ?? 0) + 1,
              draft: rebased,
              baseHeaders: {
                draftStatusMessage: headers.draftStatusMessage,
                datePhysicalStockCountCompleted: headers.datePhysicalStockCountCompleted,
              },
              modifiedDate: (base ?? stored ?? baseline).modifiedDate,
              eTag: (base ?? stored ?? baseline).eTag,
            };
          },
        });
        assertSessionScope(scope);
        if (base) baseline = base;
        if (pendingBase === base) pendingBase = undefined;
        outdated = !!expected && expected.modifiedDate !== baseline.modifiedDate;
      },
      (next) => {
        status = next;
        publish();
      },
    );
    const api = {
      subscribeStatus(listener: () => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      getStatus: () => publishedStatus,
      activate() {
        active = true;
        closed = false;
        void load().catch((error) => {
          if (active && scope === getSessionScope()) writer.fail(error);
        });
      },
      get status() {
        return status;
      },
      get outdated() {
        return outdated;
      },
      write(draft: RequisitionDraft, base?: RequisitionRecord) {
        assertSessionScope(scope);
        if (!closed && !outdated && db) {
          pendingBase = base ?? pendingBase;
          writer.enqueue({ draft: structuredClone(draft), base: pendingBase });
        }
      },
      async flush({ allowFailure = false }: { allowFailure?: boolean } = {}) {
        try {
          await load();
          assertSessionScope(scope);
          if (!(await writer.flush())) throw status.error;
        } catch (error) {
          assertSessionScope(scope);
          if (error instanceof DraftConflictError || writer.conflicted || !allowFailure)
            throw error;
          writer.fail(error);
        }
        assertSessionScope(scope);
      },
      retry: writer.retry,
      async clear() {
        closed = true;
        writer.clear();
        await writer.wait();
        assertSessionScope(scope);
        await load();
        assertSessionScope(scope);
        await removeStored();
        expected = undefined;
        pendingBase = undefined;
        outdated = false;
        writer.reset();
      },
      async update(base: RequisitionRecord) {
        await api.clear();
        assertSessionScope(scope);
        baseline = base;
        closed = false;
        adopt.current?.(buildRequisitionDraft(base));
      },
      async resolve() {
        await writer.wait();
        assertSessionScope(scope);
        try {
          const stored = await readStored();
          assertSessionScope(scope);
          expected = stored;
          pendingBase = undefined;
          outdated = !!stored && stored.modifiedDate !== baseline.modifiedDate;
          if (!outdated) adopt.current?.(stored?.draft ?? buildRequisitionDraft(baseline));
          writer.reset();
        } catch (error) {
          writer.fail(error, true);
        }
      },
      dispose() {
        active = false;
        closed = true;
        writer.clear();
      },
    };
    return api;
  }, [draftId, scope]);
  useEffect(() => {
    controller.activate();
    return () => controller.dispose();
  }, [controller]);
  return {
    get status() {
      return controller.status;
    },
    outdated: controller.outdated,
    subscribeStatus: controller.subscribeStatus,
    getStatus: controller.getStatus,
    deviceAvailable: isSecureOrigin,
    write: controller.write,
    flush: controller.flush,
    retry: controller.retry,
    clear: controller.clear,
    update: controller.update,
    resolve: controller.resolve,
  };
}
