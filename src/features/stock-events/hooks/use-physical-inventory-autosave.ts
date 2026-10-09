import { useEffect, useState } from 'react';
import type { PhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import {
  createInventoryWriter,
  type InventorySaveStatus,
} from '@/features/stock-events/lib/physical-inventory-autosave';
import {
  type InventoryLocalCopy,
  writeInventoryLocal,
} from '@/features/stock-events/lib/physical-inventory-local';
import { getLocalDb } from '@/integrations/local-db';
import { getSessionScope } from '@/lib/session-scope';

export function usePhysicalInventoryAutosave(
  copy: InventoryLocalCopy | (() => InventoryLocalCopy | null) | null,
  form?: PhysicalInventoryForm,
) {
  const [status, setStatus] = useState<InventorySaveStatus>('saved');
  const [queued, setQueued] = useState(() => copy);
  const [writer] = useState(() => {
    const scope = getSessionScope();
    const db = getLocalDb();
    return createInventoryWriter<InventoryLocalCopy>(
      async (value) => {
        if (getSessionScope() !== scope) return;
        await writeInventoryLocal(value, scope, db);
      },
      (next) => {
        if (getSessionScope() === scope) setStatus(next);
      },
    );
  });
  useEffect(() => {
    if (copy !== queued) {
      setQueued(() => copy);
      const value = typeof copy === 'function' ? copy() : copy;
      if (value) writer.enqueue(value);
    }
  }, [copy, queued, writer]);
  useEffect(() => {
    if (!form) return;
    let previous = form.state.values.lines;
    const subscription = form.store.subscribe((state) => {
      if (state.values.lines === previous) return;
      previous = state.values.lines;
      const value = typeof copy === 'function' ? copy() : copy;
      if (value) writer.enqueue(value);
    });
    return () => subscription.unsubscribe();
  }, [copy, form, writer]);
  return {
    status: copy !== queued ? ('saving' as const) : status,
    flush: writer.flush,
    reset: () => setStatus('saved'),
  };
}
