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

export function usePhysicalInventoryAutosave(copy: InventoryLocalCopy | null) {
  const [status, setStatus] = useState<InventorySaveStatus>('saved');
  const [queued, setQueued] = useState(copy);
  const [writer] = useState(() => {
    const scope = getSessionScope();
    return createInventoryWriter<InventoryLocalCopy>(
      async (value) => {
        if (getSessionScope() !== scope) return;
        await writeInventoryLocal(value, scope, getLocalDb());
      },
      (next) => {
        if (getSessionScope() === scope) setStatus(next);
      },
    );
  });
  useEffect(() => {
    if (copy !== queued) {
      setQueued(copy);
      if (copy) writer.enqueue(copy);
    }
  }, [copy, queued, writer]);
  return {
    status: copy !== queued ? ('saving' as const) : status,
    flush: writer.flush,
    reset: () => setStatus('saved'),
  };
}
