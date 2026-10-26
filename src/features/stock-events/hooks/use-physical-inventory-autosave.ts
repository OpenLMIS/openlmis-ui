import { useEffect, useRef, useState } from 'react';
import type { PhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import {
  createInventoryWriter,
  type InventorySaveStatus,
} from '@/features/stock-events/lib/physical-inventory-autosave';
import {
  clearInventoryLocal,
  type InventoryLocalCopy,
  type InventoryReference,
  readInventoryLocal,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { getLocalDb } from '@/integrations/local-db';
import { assertDraftRevision, DraftConflictError } from '@/lib/draft-store';
import { getSessionScope } from '@/lib/session-scope';

export function usePhysicalInventoryAutosave(
  copy: () => InventoryLocalCopy | null,
  form: PhysicalInventoryForm,
  initialRevision?: number,
  onAdopt?: (copy: InventoryLocalCopy | undefined) => void,
  initialCopy?: InventoryLocalCopy,
) {
  const adopt = useRef(onAdopt);
  adopt.current = onAdopt;
  const [status, setStatus] = useState<InventorySaveStatus>('saved');
  const [queued, setQueued] = useState(() => copy);
  const [writer] = useState(() => {
    const scope = getSessionScope();
    const db = getLocalDb();
    let revision = initialRevision;
    const initialLines = form.state.values.lines;
    let persistedReference: InventoryReference | undefined;
    let pendingReference: InventoryReference | undefined;
    let metadata = initialCopy;
    let quiet = false;
    let resolving = false;
    let draftId: string | undefined;
    let observed: DraftConflictError<InventoryLocalCopy> | undefined;
    const serial = createInventoryWriter<{
      copy: InventoryLocalCopy;
      reference?: InventoryReference;
    }>(
      async ({ copy: value, reference }) => {
        if (getSessionScope() !== scope) return;
        draftId = value.draftId;
        const next = {
          ...value,
          fetchedAt: reference?.fetchedAt ?? metadata?.fetchedAt,
          generation: reference?.generation ?? metadata?.generation,
          revision,
        };
        try {
          const referenceToWrite =
            reference === persistedReference && !resolving ? undefined : reference;
          const commit = () =>
            writeInventoryLocal(
              resolving ? { ...next, revision, orphaned: false } : { ...next, revision },
              scope,
              db,
              referenceToWrite,
              resolving ? true : undefined,
            );
          let saved: InventoryLocalCopy | undefined;
          try {
            saved = await commit();
          } catch (error) {
            if (
              revision !== undefined ||
              !(error instanceof DraftConflictError) ||
              !error.stored ||
              error.stored.modified ||
              error.stored.orphaned ||
              JSON.stringify(error.stored.lines) !== JSON.stringify(Object.values(initialLines))
            )
              throw error;
            revision = error.stored.revision;
            saved = await commit();
          }
          if (referenceToWrite) persistedReference = referenceToWrite;
          revision = saved?.revision;
          metadata = saved;
          if (pendingReference === reference) pendingReference = undefined;
        } catch (error) {
          if (error instanceof DraftConflictError) {
            observed = error;
            if (!value.modified && !form.state.isDirty && error.stored && !error.stored.orphaned) {
              revision = error.stored.revision;
              metadata = error.stored;
              pendingReference = undefined;
              adopt.current?.(error.stored);
              return;
            }
          }
          throw error;
        } finally {
          resolving = false;
        }
      },
      (next) => {
        if (getSessionScope() === scope && !(quiet && next === 'saving')) setStatus(next);
      },
    );
    const enqueue = (value: InventoryLocalCopy, reference?: InventoryReference) => {
      quiet = !value.modified;
      pendingReference = reference ?? pendingReference;
      serial.enqueue({ copy: value, reference: pendingReference });
    };
    return {
      ...serial,
      enqueue,
      reset: serial.reset,
      async loadLatest() {
        const latest = draftId ? await readInventoryLocal(draftId) : undefined;
        if (getSessionScope() !== scope) return;
        try {
          if (latest) assertDraftRevision(latest, observed?.stored);
        } catch (error) {
          if (error instanceof DraftConflictError) {
            observed = error;
          }
          throw error;
        }
        if (latest?.orphaned) throw new Error('This inventory copy is no longer current');
        revision = latest?.revision ?? 0;
        metadata = latest;
        pendingReference = undefined;
        serial.resolve();
        adopt.current?.(latest);
      },
      async keepCounts(value: InventoryLocalCopy, reference?: InventoryReference) {
        await serial.wait();
        if (getSessionScope() !== scope) return;
        revision = observed?.stored?.revision ?? 0;
        metadata = observed?.stored;
        resolving = true;
        serial.resolve();
        enqueue(value, reference);
        await serial.flush();
      },
      async clear(draftId: string) {
        await serial.clear((conflict) =>
          clearInventoryLocal(
            draftId,
            conflict instanceof DraftConflictError
              ? (conflict.stored?.revision ?? 0)
              : (revision ?? 0),
            scope,
            db,
          ),
        );
        revision = undefined;
      },
    };
  });
  const [staged, setStaged] = useState<InventoryLocalCopy | null>(null);
  if (copy !== queued) {
    setQueued(() => copy);
    const value = copy();
    setStaged(value);
    if (value?.modified && status === 'saved') setStatus('saving');
  }
  useEffect(() => {
    if (staged) writer.enqueue(staged);
  }, [staged, writer]);
  useEffect(() => {
    let previous = form.state.values.lines;
    const subscription = form.store.subscribe((state) => {
      if (state.values.lines === previous) return;
      previous = state.values.lines;
      const value = copy();
      if (value) writer.enqueue(value);
    });
    return () => subscription.unsubscribe();
  }, [copy, form, writer]);
  return {
    status,
    loadLatest: writer.loadLatest,
    keepCounts: writer.keepCounts,
    flush: writer.flush,
    retry: writer.retry,
    clear: writer.clear,
    async write(value: InventoryLocalCopy, reference?: InventoryReference) {
      writer.enqueue(value, reference);
      await writer.flush();
    },
    reset: writer.reset,
  };
}
