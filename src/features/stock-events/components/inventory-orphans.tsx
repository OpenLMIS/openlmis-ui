import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { inventoryOrphansOptions } from '@/features/stock-events/api/physical-inventory-queries';
import { clearInventoryLocal } from '@/features/stock-events/lib/physical-inventory-local';
import type { InventoryScope } from '@/features/stock-events/lib/physical-inventory-types';
import { getLocalDb } from '@/integrations/local-db';
import { reportCaughtError } from '@/lib/report-error';
import { getSessionScope } from '@/lib/session-scope';

export function InventoryOrphans({ scope }: { scope: InventoryScope }) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const copies = useQuery(inventoryOrphansOptions(scope));
  if (!copies.data?.length) return null;
  const discard = async () => {
    const session = getSessionScope();
    setPending(true);
    try {
      const db = getLocalDb();
      for (const copy of copies.data ?? [])
        await clearInventoryLocal(copy.draftId, copy.revision ?? 0, session, db);
      if (getSessionScope() === session) setConfirm(false);
    } catch (error) {
      reportCaughtError(error, {});
      if (getSessionScope() === session)
        toast.error(t('physical-inventory.copy-error-title'), {
          description: t('physical-inventory.copy-error-description'),
        });
    } finally {
      if (getSessionScope() === session) {
        await copies.refetch();
        if (getSessionScope() === session) setPending(false);
      }
    }
  };
  return (
    <>
      <Alert variant="warning" role="note">
        <AlertDescription>
          <p>{t('physical-inventory.orphaned-counts')}</p>
          <Button variant="warning" disabled={pending} onClick={() => setConfirm(true)}>
            {t('physical-inventory.discard-copy')}
          </Button>
        </AlertDescription>
      </Alert>
      <AlertDialog open={confirm} onOpenChange={(open) => !pending && setConfirm(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('physical-inventory.discard-copy')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('physical-inventory.discard-copy-description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('stock-events.cancel')}</AlertDialogCancel>
            <Button variant="destructive" disabled={pending} onClick={() => void discard()}>
              {t('physical-inventory.discard-copy')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
