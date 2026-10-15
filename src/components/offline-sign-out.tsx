import { useEffect, useRef, useState } from 'react';
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
import { useLoginData } from '@/features/auth/store/login-data';
import { whenLeaveAllowed } from '@/hooks/use-leave-guard';
import { isOnline } from '@/lib/online';
import { getSessionScope, useSessionScope } from '@/lib/session-scope';
import { countUnsyncedDeviceWork } from '@/lib/unsynced-device-work';

export function useOfflineSignOut() {
  const { t } = useTranslation();
  const scope = useSessionScope();
  const checking = useRef<number | null>(null);
  const [pending, setPending] = useState<{
    scope: number;
    proceed: () => void;
    offline: boolean;
    count: number | null;
  } | null>(null);

  useEffect(() => {
    setPending((pending) => (pending?.scope === scope ? pending : null));
    if (checking.current !== scope) checking.current = null;
  }, [scope]);

  const confirm = (proceed: () => void, knownOffline = false) => {
    const scope = getSessionScope();
    const current = () => scope === getSessionScope();
    whenLeaveAllowed(() => {
      if (!current() || checking.current === scope) return;
      checking.current = scope;
      void (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let count: number | null = null;
        try {
          count = await Promise.race([
            countUnsyncedDeviceWork(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('Device check timed out')), 5000);
            }),
          ]);
        } catch {
          count = null;
        } finally {
          clearTimeout(timer);
          if (checking.current === scope) checking.current = null;
        }
        if (!current() || !useLoginData.getState().isAuthenticated) return;
        const offline = !isOnline() || knownOffline;
        const guardedProceed = () => {
          if (current()) proceed();
        };
        if (offline || count === null || count)
          setPending({ scope, proceed: guardedProceed, offline, count });
        else guardedProceed();
      })();
    });
  };

  const dialog = (
    <AlertDialog onOpenChange={(next) => !next && setPending(null)} open={pending !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(
              pending?.count === null || pending?.count
                ? 'sign-out-device.title'
                : 'sign-out-offline.title',
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {[
              pending?.count === null
                ? t('sign-out-device.check-failed')
                : pending?.count
                  ? t('sign-out-device.description', { count: pending.count })
                  : null,
              pending?.offline ? t('sign-out-offline.description') : null,
            ]
              .filter(Boolean)
              .join(' ')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('sign-out-offline.stay')}</AlertDialogCancel>
          <Button
            onClick={() => {
              setPending(null);
              pending?.proceed();
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
