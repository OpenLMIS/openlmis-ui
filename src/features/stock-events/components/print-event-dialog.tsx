import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { EventPrintCopy } from '@/features/stock-events/lib/event-kinds';

type Props = {
  copy: EventPrintCopy;
  open: boolean;
  onPrint: () => void;
  onSkip: () => void;
};

export function PrintEventDialog({ copy, open, onPrint, onSkip }: Props) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onSkip();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(copy.title)}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onSkip}>
            {t(copy.skip)}
          </Button>
          <Button onClick={onPrint}>{t('stock-event.print')}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
