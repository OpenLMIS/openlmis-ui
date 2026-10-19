import { CircleAlertIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function useOfflineNavigation() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  return {
    open,
    show: (target = document.activeElement as HTMLElement | null) => {
      returnFocus.current = target;
      setOpen(true);
    },
    dialog: (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent finalFocus={returnFocus}>
          <AlertDialogHeader>
            <AlertDialogMedia variant="destructive">
              <CircleAlertIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>{t('offline.navigation-title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('offline.navigation-unavailable')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  };
}
