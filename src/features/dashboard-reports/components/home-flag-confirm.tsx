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

export function HomeFlagConfirm({
  proposal,
  onCancel,
  onConfirm,
}: {
  proposal?: { current: string; name: string; enabled: boolean };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(proposal);
  if (proposal && proposal !== shown) setShown(proposal);
  return (
    <AlertDialog open={!!proposal} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dashboard-reports.home-confirm.title')}</AlertDialogTitle>
          {shown && (
            <AlertDialogDescription>
              <span className="wrap-anywhere">
                {t('dashboard-reports.home-confirm.description', {
                  current: shown.current,
                  name: shown.name,
                })}
                {!shown.enabled && (
                  <> {t('dashboard-reports.home-confirm.disabled', { name: shown.name })}</>
                )}
              </span>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('dialog.cancel')}</AlertDialogCancel>
          <Button type="button" onClick={onConfirm}>
            {t('dashboard-reports.home-confirm.action')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
