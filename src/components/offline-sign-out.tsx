import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { getSessionScope } from '@/lib/session-scope';
import { countUnsyncedDeviceWork } from '@/lib/unsynced-device-work';

export function useOfflineSignOut() {
  const { t } = useTranslation();
  const checking = useRef(false);
  const [pending, setPending] = useState<{
    proceed: () => void;
    offline: boolean;
    count: number;
  } | null>(null);

  const confirm = (proceed: () => void, knownOffline = false) => {
    const scope = getSessionScope();
    const current = () => scope === getSessionScope();
    whenLeaveAllowed(() => {
      if (!current() || checking.current) return;
      checking.current = true;
      void (async () => {
        try {
          const count = await countUnsyncedDeviceWork();
          if (!current()) return;
          const offline = !isOnline() || knownOffline;
          const guardedProceed = () => {
            if (current()) proceed();
          };
          if (offline || count) setPending({ proceed: guardedProceed, offline, count });
          else guardedProceed();
        } catch {
          if (current() && useLoginData.getState().isAuthenticated)
            toast.error(t('sign-out-device.check-failed-title'), {
              description: t('sign-out-device.check-failed'),
            });
        } finally {
          checking.current = false;
        }
      })();
    });
  };

  const dialog = (
    <AlertDialog onOpenChange={(next) => !next && setPending(null)} open={pending !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(pending?.count ? 'sign-out-device.title' : 'sign-out-offline.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.count ? t('sign-out-device.description', { count: pending.count }) : null}
            {pending?.offline ? ` ${t('sign-out-offline.description')}` : null}
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
