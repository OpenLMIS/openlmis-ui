import { useEffect, useState } from 'react';
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
  return {
    status: copy !== queued ? ('saving' as const) : status,
    flush: writer.flush,
    reset: () => setStatus('saved'),
  };
}
