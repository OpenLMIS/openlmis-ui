import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceWork } from '@/components/app-shell/device-work';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
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

export function useOfflineSignOut() {
  const { t } = useTranslation();
  const { countUnsyncedWork } = useDeviceWork();
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
            countUnsyncedWork(),
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
    }, 'sign-out');
  };

  const target = useDialogTarget(pending ?? undefined, () => setPending(null));
  const shown = target.shown;
  const dialog = (
    <AlertDialog {...target.dialogProps()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(
              shown?.count === null
                ? 'sign-out-device.check-failed-title'
                : shown?.count
                  ? 'sign-out-device.title'
                  : 'sign-out-offline.title',
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {[
              shown?.count === null
                ? t('sign-out-device.check-failed')
                : shown?.count
                  ? t('sign-out-device.description', { count: shown.count })
                  : null,
              shown?.offline ? t('sign-out-offline.description') : null,
            ]
              .filter(Boolean)
              .join(' ')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('sign-out-offline.stay')}</AlertDialogCancel>
          <Button
            onClick={() => {
              if (target.close()) shown?.proceed();
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
