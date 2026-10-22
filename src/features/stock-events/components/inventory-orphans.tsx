import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  clearInventoryLocal,
  readInventoryScope,
} from '@/features/stock-events/lib/physical-inventory-local';
import type { InventoryScope } from '@/features/stock-events/lib/physical-inventory-types';
import { getLocalDb } from '@/integrations/local-db';
import { queryKeys } from '@/lib/key-factory';
import { getSessionScope } from '@/lib/session-scope';

export function InventoryOrphans({ scope }: { scope: InventoryScope }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const copies = useQuery({
    queryKey: [...queryKeys.physicalInventories.list(scope), 'orphans'],
    queryFn: async () => (await readInventoryScope(scope)).filter((copy) => copy.orphaned),
  });
  if (!copies.data?.length) return null;
  return (
    <Alert variant="warning">
      <AlertDescription>
        <p>{t('physical-inventory.orphaned-counts')}</p>
        <Button
          variant="warning"
          disabled={pending}
          onClick={async () => {
            const session = getSessionScope();
            const db = getLocalDb();
            setPending(true);
            try {
              for (const copy of copies.data ?? [])
                await clearInventoryLocal(copy.draftId, copy.revision ?? 0, session, db);
            } catch {
              // A changed copy must be reviewed before discarding again.
            } finally {
              if (getSessionScope() === session) await copies.refetch();
              if (getSessionScope() === session) setPending(false);
            }
          }}
        >
          {t('physical-inventory.discard-copy')}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
