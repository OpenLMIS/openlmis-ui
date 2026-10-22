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
  onAdopt?: (copy: InventoryLocalCopy) => void,
) {
  const adopt = useRef(onAdopt);
  adopt.current = onAdopt;
  const [conflict, setConflict] = useState<DraftConflictError<InventoryLocalCopy>>();
  const [status, setStatus] = useState<InventorySaveStatus>('saved');
  const [queued, setQueued] = useState(() => copy);
  const [writer] = useState(() => {
    const scope = getSessionScope();
    const db = getLocalDb();
    let revision = initialRevision;
    let pendingReference: InventoryReference | undefined;
    let metadata: InventoryLocalCopy | undefined;
    let quiet = false;
    let observed: DraftConflictError<InventoryLocalCopy> | undefined;
    const serial = createInventoryWriter<{
      copy: InventoryLocalCopy;
      reference?: InventoryReference;
    }>(
      async ({ copy: value, reference }) => {
        if (getSessionScope() !== scope) return;
        const next = {
          ...value,
          fetchedAt: reference?.fetchedAt ?? value.fetchedAt ?? metadata?.fetchedAt,
          generation: reference?.generation ?? value.generation ?? metadata?.generation,
          revision,
        };
        try {
          const referenceToWrite =
            reference?.generation === metadata?.generation ? undefined : reference;
          const saved = referenceToWrite
            ? await writeInventoryLocal(next, scope, db, referenceToWrite)
            : await writeInventoryLocal(next, scope, db);
          revision = saved?.revision;
          metadata = saved;
          if (pendingReference === reference) pendingReference = undefined;
        } catch (error) {
          if (error instanceof DraftConflictError) {
            observed = error;
            if (!value.modified && !form.state.isDirty && error.stored && !error.stored.orphaned) {
              revision = error.stored.revision;
              metadata = error.stored;
              adopt.current?.(error.stored);
              return;
            }
            setConflict(error);
          }
          throw error;
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
        if (!observed?.stored) throw new Error('No current inventory copy');
        const latest = await readInventoryLocal(observed.stored.draftId);
        try {
          assertDraftRevision(latest, observed.stored);
        } catch (error) {
          if (error instanceof DraftConflictError) {
            observed = error;
            setConflict(error);
          }
          throw error;
        }
        if (!latest || latest.orphaned) throw new Error('No current inventory copy');
        adopt.current?.(latest);
      },
      async keepCounts(value: InventoryLocalCopy, reference?: InventoryReference) {
        if (!observed?.stored || observed.stored.orphaned)
          throw new Error('No current inventory copy');
        await serial.wait();
        revision = observed.stored.revision;
        serial.resolve();
        setConflict(undefined);
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
  useEffect(() => {
    if (copy !== queued) {
      setQueued(() => copy);
      const value = copy();
      if (value) writer.enqueue(value);
    }
  }, [copy, queued, writer]);
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
    status: copy !== queued && copy()?.modified ? ('saving' as const) : status,
    conflict,
    loadLatest: writer.loadLatest,
    keepCounts: writer.keepCounts,
    flush: writer.flush,
    clear: writer.clear,
    async write(value: InventoryLocalCopy, reference?: InventoryReference) {
      writer.enqueue(value, reference);
      await writer.flush();
    },
    reset: writer.reset,
  };
}
