import { useEffect, useState } from 'react';
import type { PhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import {
  createInventoryWriter,
  type InventorySaveStatus,
} from '@/features/stock-events/lib/physical-inventory-autosave';
import {
  clearInventoryLocal,
  type InventoryLocalCopy,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { getLocalDb } from '@/integrations/local-db';
import { DraftConflictError } from '@/lib/draft-store';
import { getSessionScope } from '@/lib/session-scope';

export function usePhysicalInventoryAutosave(
  copy: () => InventoryLocalCopy | null,
  form: PhysicalInventoryForm,
  initialRevision?: number,
) {
  const [status, setStatus] = useState<InventorySaveStatus>('saved');
  const [queued, setQueued] = useState(() => copy);
  const [writer] = useState(() => {
    const scope = getSessionScope();
    const db = getLocalDb();
    let revision = initialRevision;
    const serial = createInventoryWriter<InventoryLocalCopy>(
      async (value) => {
        if (getSessionScope() !== scope) return;
        const saved = await writeInventoryLocal({ ...value, revision }, scope, db);
        revision = saved?.revision;
      },
      (next) => {
        if (getSessionScope() === scope) setStatus(next);
      },
    );
    return {
      ...serial,
      reset: serial.reset,
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
    status: copy !== queued ? ('saving' as const) : status,
    flush: writer.flush,
    clear: writer.clear,
    async write(value: InventoryLocalCopy) {
      writer.enqueue(value);
      await writer.flush();
    },
    reset: writer.reset,
  };
}
