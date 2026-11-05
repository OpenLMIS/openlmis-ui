import { liveQuery } from 'dexie';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildRequisitionDraft,
  type RequisitionDraft,
  rebaseRequisitionDraft,
} from '@/features/requisitions/lib/draft';
import { type DraftBaseValues, draftBaseValues } from '@/features/requisitions/lib/draft-merge';
import {
  assertCopyLease,
  beginCopy,
  copyLeaseFor,
} from '@/features/requisitions/lib/offline-copies';
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
  baseValues?: DraftBaseValues;
  baseHeaders?: Pick<RequisitionDraft, 'draftStatusMessage' | 'datePhysicalStockCountCompleted'>;
};

export function useRequisitionDraft(
  record: RequisitionRecord,
  onLoad?: (draft: RequisitionDraft) => void,
  loaderRecord = record,
) {
  const scope = useSessionScope();
  const draftId = record.id;
  const initial = useRef(record);
  initial.current = record;
  const leaseSource = useRef(copyLeaseFor(loaderRecord));
  const nextLease = copyLeaseFor(loaderRecord);
  if (
    leaseSource.current?.generation !== nextLease?.generation ||
    leaseSource.current?.userId !== nextLease?.userId ||
    leaseSource.current?.session !== nextLease?.session ||
    leaseSource.current?.id !== nextLease?.id
  )
    leaseSource.current = nextLease;
  const currentLease = leaseSource.current;
  const adopt = useRef(onLoad);
  adopt.current = onLoad;
  const [, setVersion] = useState(0);
  const controller = useMemo(() => {
    let baseline = initial.current;
    const userId = isSecureOrigin ? getSessionUserId() : null;
    const db = userId ? getLocalDb() : undefined;
    const table = db?.table<RequisitionLocalDraft, string>(LOCAL_TABLES.requisitionDrafts);
    let expected: RequisitionLocalDraft | undefined;
    let lease = currentLease;
    let unsubscribe: (() => void) | undefined;
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
        tables: [LOCAL_TABLES.requisitionCopyLifecycles],
        read: async () => {
          if (lease) await assertCopyLease(lease);
          return table.get(draftId);
        },
        next: () => undefined,
      });
      assertSessionScope(scope);
    };
    let loaded: Promise<void> | undefined;
    let initialized = false;
    let writeTimer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      loaded ??= (async () => {
        if (db) lease ??= await beginCopy(draftId);
        if (lease) await assertCopyLease(lease);
        return readStored();
      })().then(async (stored) => {
        assertSessionScope(scope);
        expected = stored;
        if (
          stored &&
          db &&
          table &&
          (!hasUnsyncedRequisitionDraft(stored) ||
            (stored.modifiedDate === baseline.modifiedDate &&
              JSON.stringify(rebaseRequisitionDraft(baseline, stored.draft)) ===
                JSON.stringify(buildRequisitionDraft(baseline))))
        ) {
          await removeStored();
          expected = undefined;
          stored = undefined;
        }
        outdated = !!stored && stored.modifiedDate !== baseline.modifiedDate;
        if (active && stored) adopt.current?.(rebaseRequisitionDraft(baseline, stored.draft));
        initialized = true;
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
          tables: [LOCAL_TABLES.requisitionCopyLifecycles],
          read: async () => {
            if (lease) await assertCopyLease(lease);
            return table.get(draftId);
          },
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
              baseValues: draftBaseValues(currentBase, rebased),
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
      recoveryDraft: () => (outdated ? expected?.draft : undefined),
      baseValues: () => expected?.baseValues,
      async rebase(draft: RequisitionDraft, base: RequisitionRecord) {
        await api.flush({ allowFailure: true });
        assertSessionScope(scope);
        baseline = base;
        outdated = false;
        closed = false;
        api.write(draft, base);
        await api.flush();
        assertSessionScope(scope);
        adopt.current?.(draft);
        publish();
      },
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
        if (db) {
          const subscription = liveQuery(() =>
            db.table(LOCAL_TABLES.requisitionCopyLifecycles).get(draftId),
          ).subscribe(() => {
            if (lease && !closed)
              void assertCopyLease(lease).catch((error) => {
                if (active && !closed && scope === getSessionScope()) {
                  closed = true;
                  outdated = true;
                  writer.fail(error, true);
                }
              });
          });
          unsubscribe = () => subscription.unsubscribe();
        }
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
          writer.stage({ draft, base: pendingBase });
          clearTimeout(writeTimer);
          writeTimer = setTimeout(() => writer.start(), 250);
        }
      },
      async flush({ allowFailure = false }: { allowFailure?: boolean } = {}) {
        clearTimeout(writeTimer);
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
      async retry() {
        if (closed || writer.conflicted) return;
        try {
          if (!initialized) {
            loaded = undefined;
            await load();
            assertSessionScope(scope);
          }
          writer.retry();
        } catch (error) {
          if (active && scope === getSessionScope()) writer.fail(error);
        }
      },
      async clear() {
        clearTimeout(writeTimer);
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
        try {
          await api.clear();
          assertSessionScope(scope);
          baseline = base;
          closed = false;
          adopt.current?.(buildRequisitionDraft(base));
        } catch (error) {
          assertSessionScope(scope);
          closed = false;
          writer.fail(error);
          throw error;
        }
      },
      async resolve() {
        await writer.wait();
        assertSessionScope(scope);
        try {
          if (lease) await assertCopyLease(lease);
          const stored = await readStored();
          assertSessionScope(scope);
          expected = stored;
          pendingBase = undefined;
          outdated = !!stored && stored.modifiedDate !== baseline.modifiedDate;
          adopt.current?.(
            stored
              ? rebaseRequisitionDraft(baseline, stored.draft)
              : buildRequisitionDraft(baseline),
          );
          writer.reset();
        } catch (error) {
          writer.fail(error, true);
        }
      },
      dispose() {
        clearTimeout(writeTimer);
        active = false;
        unsubscribe?.();
        closed = true;
        writer.clear();
      },
    };
    return api;
  }, [draftId, scope, currentLease]);
  useEffect(() => {
    controller.activate();
    return () => controller.dispose();
  }, [controller]);
  return {
    recoveryDraft: controller.recoveryDraft,
    baseValues: controller.baseValues,
    rebase: controller.rebase,
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
