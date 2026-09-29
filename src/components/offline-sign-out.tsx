import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { isOnline } from '@/lib/online';

/** Signing in again needs the server, so a sign out while offline asks first. */
export function useOfflineSignOut() {
  const { t } = useTranslation();
  const [pending, setPending] = useState<(() => void) | null>(null);

  const confirm = (proceed: () => void, knownOffline = false) => {
    if (isOnline() && !knownOffline) proceed();
    else setPending(() => proceed);
  };

  const dialog = (
    <AlertDialog onOpenChange={(next) => !next && setPending(null)} open={pending !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('sign-out-offline.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('sign-out-offline.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('sign-out-offline.stay')}</AlertDialogCancel>
          <Button
            onClick={() => {
              setPending(null);
              pending?.();
            }}
            variant="destructive"
          >
            {t('sign-out-offline.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
