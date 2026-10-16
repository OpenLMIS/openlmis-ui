import { useTranslation } from 'react-i18next';
import { ActionTooltip } from '@/components/action-tooltip';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { EventPrintCopy } from '@/features/stock-events/lib/event-kinds';
import { useOnline } from '@/lib/online';

type Props = {
  copy: EventPrintCopy;
  open: boolean;
  onPrint: () => void;
  onSkip: () => void;
};

export function PrintEventDialog({ copy, open, onPrint, onSkip }: Props) {
  const { t } = useTranslation();
  const online = useOnline();
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
          <ActionTooltip reason={online ? undefined : t('offline.print-description')}>
            <Button
              disabled={!online}
              focusableWhenDisabled={!online}
              aria-description={!online ? t('offline.print-description') : undefined}
              onClick={onPrint}
            >
              {t('stock-event.print')}
            </Button>
          </ActionTooltip>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
