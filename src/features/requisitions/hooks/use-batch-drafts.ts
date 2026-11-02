import { useEffect, useMemo, useRef } from 'react';
import { batchText, matchesBaseline } from '@/features/requisitions/lib/batch';
import {
  readBatchSessionMarker,
  writeBatchSessionMarker,
} from '@/features/requisitions/lib/batch-session-markers';
import type {
  BatchLine,
  BatchQuantities,
  BatchRequisition,
} from '@/features/requisitions/lib/batch-types';
import i18n from '@/integrations/i18n';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { saveRevisionedDraft } from '@/lib/draft-store';
import { createDraftWriter, type DraftSaveState } from '@/lib/draft-writer';
import { readOwnedRecord } from '@/lib/local-records';
import { isSecureOrigin } from '@/lib/secure-context';
import {
  assertSessionScope,
  getSessionScope,
  getSessionUserId,
  useSessionScope,
} from '@/lib/session-scope';

export type BatchLocalDraft = {
  draftId: string;
  userId: string;
  formatVersion: number;
  revision: number;
  baselineModifiedDate: string;
  baselineStatus: string;
  approvedQuantities: Record<string, string>;
  unresolvedApproval?: { attemptedAt: string };
};

export function useBatchDrafts(records: readonly BatchRequisition[]) {
  const scope = useSessionScope();
  const previous = useRef<BatchDrafts | null>(null);
  const controller = useMemo(
    () => createBatchDrafts(records, scope, previous.current?.memory()),
    [records, scope],
  );
  useEffect(() => {
    previous.current = controller;
    controller.activate();
    return controller.dispose;
  }, [controller]);
  return controller;
}

export type BatchDrafts = ReturnType<typeof createBatchDrafts>;
type BatchMemory = Map<
  string,
  {
    base: BatchRequisition;
    changes: Record<string, string>;
    unresolved: BatchLocalDraft['unresolvedApproval'];
    outdated: boolean;
  }
>;
function createBatchDrafts(
  records: readonly BatchRequisition[],
  scope: number,
  memory?: { scope: number; entries: BatchMemory },
) {
  const userId = getSessionUserId();
  const db = isSecureOrigin && userId ? getLocalDb() : undefined;
  const table = db?.table<BatchLocalDraft, string>(LOCAL_TABLES.requisitionBatchDrafts);
  const entries = new Map(
    records.map((base) => {
      const previous = !db && memory?.scope === scope ? memory.entries.get(base.id) : undefined;
      return [
        base.id,
        {
          base,
          expected: undefined as BatchLocalDraft | undefined,
          changes: { ...previous?.changes } as Record<string, string>,
          unresolved: previous?.unresolved,
          outdated:
            !!previous &&
            (previous.outdated ||
              (!!Object.keys(previous.changes).length &&
                previous.base.modifiedDate !== base.modifiedDate)),
        },
      ];
    }),
  );
  let active = false;
  let ready = false;
  let status: DraftSaveState = { status: 'loading' };
  const listeners = new Map<string, Set<() => void>>();
  const versions = new Map<string, number>();
  const emit = (key: string) => {
    if (!active || scope !== getSessionScope()) return;
    versions.set(key, (versions.get(key) ?? 0) + 1);
    for (const listener of listeners.get(key) ?? []) listener();
  };
  const publish = (next: DraftSaveState) => {
    if (next.status === status.status && next.error === status.error) return;
    status = next;
    emit('status');
  };
  const notifyRecord = (id: string) => {
    const entry = entries.get(id);
    for (const line of entry?.base.requisitionLineItems ?? []) {
      emit(`${id}:${line.id}`);
      emit(`product:${line.orderable.id}`);
    }
    emit('totals');
    emit('meta');
    emit('dirty');
  };
  const loadRecord = async (id: string) => {
    const entry = entries.get(id);
    if (!entry) return;
    if (!db) {
      const marker = userId ? readBatchSessionMarker(userId, id) : undefined;
      entry.unresolved = marker ? { attemptedAt: marker.attemptedAt } : undefined;
      entry.expected = marker
        ? {
            draftId: id,
            userId: marker.userId,
            formatVersion: 1,
            revision: 0,
            baselineModifiedDate: marker.baselineModifiedDate,
            baselineStatus: marker.baselineStatus,
            approvedQuantities: {},
            unresolvedApproval: entry.unresolved,
          }
        : undefined;
      notifyRecord(id);
      return;
    }
    const stored = await readOwnedRecord<BatchLocalDraft>(LOCAL_TABLES.requisitionBatchDrafts, id, {
      formats: [1],
    });
    assertSessionScope(scope);
    entry.expected = stored;
    entry.outdated = !!stored && stored.baselineModifiedDate !== entry.base.modifiedDate;
    entry.changes = { ...stored?.approvedQuantities };
    entry.unresolved = stored?.unresolvedApproval;
    notifyRecord(id);
  };
  let loaded: Promise<void> | undefined;
  const load = () =>
    (loaded ??= Promise.all([...entries.keys()].map(loadRecord)).then(() => {
      assertSessionScope(scope);
      ready = true;
      publish({ status: 'saved' });
      emit('meta');
    }));
  const states = new Map<string, DraftSaveState>();
  const writers = new Map(
    [...entries].map(([id, entry]) => [
      id,
      createDraftWriter<{
        changes: Record<string, string>;
        unresolved: BatchLocalDraft['unresolvedApproval'];
      }>(
        async (value) => {
          await load();
          assertSessionScope(scope);
          if (!db || !table || !userId) return;
          entry.expected = await saveRevisionedDraft({
            db,
            table,
            sessionScope: scope,
            expected: entry.expected,
            read: () => table.get(id),
            next: (stored) =>
              Object.keys(value.changes).length || value.unresolved
                ? {
                    draftId: id,
                    userId,
                    formatVersion: 1,
                    revision: (stored?.revision ?? 0) + 1,
                    baselineModifiedDate: entry.base.modifiedDate,
                    baselineStatus: entry.base.status,
                    approvedQuantities: value.changes,
                    unresolvedApproval: value.unresolved,
                  }
                : undefined,
          });
          assertSessionScope(scope);
        },
        (next) => {
          states.set(id, next);
          const all = [...states.values()];
          const combined = ['conflict', 'failed', 'saving', 'loading']
            .map((status) => all.find((s) => s.status === status))
            .find(Boolean);
          publish(combined ?? { status: 'saved' });
        },
      ),
    ]),
  );
  const enqueue = (id: string) => {
    const entry = entries.get(id);
    if (!entry) return;
    if (db)
      writers.get(id)?.enqueue({ changes: { ...entry.changes }, unresolved: entry.unresolved });
  };
  const api = {
    deviceAvailable: !!db,
    ready: () => ready,
    memory: () => ({ scope, entries }),
    subscribe(key: string, listener: () => void) {
      let group = listeners.get(key);
      if (!group) {
        group = new Set();
        listeners.set(key, group);
      }
      group.add(listener);
      return () => {
        group.delete(listener);
      };
    },
    version: (key: string) => versions.get(key) ?? 0,
    subscribeStatus: (listener: () => void) => api.subscribe('status', listener),
    getStatus: () => status,
    text: (id: string, line: BatchLine) => batchText(line, entries.get(id)?.changes),
    dirty: () => [...entries.values()].some((e) => Object.keys(e.changes).length > 0),
    quantities: (): BatchQuantities =>
      Object.fromEntries([...entries].map(([id, entry]) => [id, entry.changes])),
    outdated: (id: string) => entries.get(id)?.outdated ?? false,
    unresolved: (id: string) => !!entries.get(id)?.unresolved,
    unresolvedChanged(id: string, fresh: BatchRequisition | undefined) {
      const e = entries.get(id);
      return (
        !!e?.unresolved &&
        !matchesBaseline(
          fresh,
          e.expected ?? {
            baselineModifiedDate: e.base.modifiedDate,
            baselineStatus: e.base.status,
          },
        )
      );
    },
    set(id: string, lineId: string, text: string) {
      assertSessionScope(scope);
      const e = entries.get(id);
      const line = e?.base.requisitionLineItems.find((l) => l.id === lineId);
      if (!e || !line || e.outdated || e.unresolved || !ready) return;
      if (text === String(line.approvedQuantity ?? 0)) delete e.changes[lineId];
      else e.changes[lineId] = text;
      enqueue(id);
      emit(`${id}:${lineId}`);
      emit(`product:${line.orderable.id}`);
      emit('totals');
      emit(`record:${id}`);
      emit('dirty');
    },
    async flush() {
      await load();
      assertSessionScope(scope);
      const outcomes = await Promise.all([...writers.values()].map((w) => w.flush()));
      assertSessionScope(scope);
      if (outcomes.some((ok) => !ok))
        throw status.error ?? new Error(i18n.t('requisitions.batch.save-failed'));
      publish({ status: 'saved' });
    },
    async clear(
      ids: readonly string[],
      fresh: readonly BatchRequisition[] = records,
      preserveUnresolved = true,
    ) {
      await api.flush();
      assertSessionScope(scope);
      for (const id of ids) {
        const entry = entries.get(id);
        if (!entry) continue;
        if (db && table) {
          try {
            entry.expected = await saveRevisionedDraft({
              db,
              table,
              sessionScope: scope,
              expected: entry.expected,
              read: () => table.get(id),
              next: (stored) =>
                preserveUnresolved && stored?.unresolvedApproval
                  ? { ...stored, revision: stored.revision + 1, approvedQuantities: {} }
                  : undefined,
            });
          } catch (error) {
            assertSessionScope(scope);
            publish({ status: 'conflict', error });
            throw error;
          }
          assertSessionScope(scope);
        }
        if (!db && userId && !preserveUnresolved) writeBatchSessionMarker(userId, id);
        entry.changes = {};
        if (!preserveUnresolved) entry.unresolved = undefined;
        entry.base = fresh.find((r) => r.id === id) ?? entry.base;
        entry.outdated = false;
        notifyRecord(id);
      }
    },
    async mark(ids: readonly string[], unresolved: boolean) {
      await api.flush();
      assertSessionScope(scope);
      for (const id of ids) {
        const entry = entries.get(id);
        if (!entry) continue;
        const marker = unresolved ? { attemptedAt: new Date().toISOString() } : undefined;
        if (!db) {
          if (!userId) throw new Error(i18n.t('requisitions.batch.save-failed'));
          entry.expected = undefined;
          writeBatchSessionMarker(
            userId,
            id,
            marker
              ? {
                  userId,
                  requisitionId: id,
                  attemptedAt: marker.attemptedAt,
                  baselineModifiedDate: entry.base.modifiedDate,
                  baselineStatus: entry.base.status,
                }
              : undefined,
          );
        }
        entry.unresolved = marker;
        enqueue(id);
        notifyRecord(id);
      }
      await api.flush();
      assertSessionScope(scope);
    },
    async resolve() {
      for (const writer of writers.values()) {
        await writer.wait();
        assertSessionScope(scope);
        writer.clear();
      }
      await Promise.all([...entries.keys()].map(loadRecord));
      assertSessionScope(scope);
      for (const writer of writers.values()) writer.reset();
      publish({ status: 'saved' });
    },
    retry() {
      if (!ready) {
        loaded = undefined;
        publish({ status: 'loading' });
        void load().catch((error) => {
          if (scope === getSessionScope()) publish({ status: 'failed', error });
        });
      }
      for (const writer of writers.values()) writer.retry();
    },
    activate() {
      active = true;
      void load().catch((error) => {
        if (scope === getSessionScope()) publish({ status: 'failed', error });
      });
    },
    dispose() {
      active = false;
    },
  };
  return api;
}
