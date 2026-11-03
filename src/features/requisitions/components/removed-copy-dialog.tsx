import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { allowUnload } from '@/hooks/use-leave-guard';

export function RemovedCopyDialog() {
  const { t } = useTranslation();
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('requisitions.offline.removed-title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('requisitions.offline.removed-description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            onClick={() => {
              allowUnload();
              window.location.reload();
            }}
          >
            {t('error.try-again')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
