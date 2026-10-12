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
import { type ConfiguredEventKind, EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';

type ClearLinesDialogProps = {
  kind: ConfiguredEventKind;
  open: boolean;
  count: number;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
  restoreFocus?: () => HTMLElement | null | undefined;
};

export function ClearLinesDialog({
  kind,
  open,
  count,
  onOpenChange,
  onClear,
  restoreFocus,
}: ClearLinesDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent finalFocus={restoreFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(EVENT_KINDS[kind].copy.clearTitle)}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(EVENT_KINDS[kind].copy.clearDescription, { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('stock-events.cancel')}</AlertDialogCancel>
          <Button
            onClick={() => {
              onClear();
              onOpenChange(false);
            }}
            variant="destructive"
          >
            {t('stock-events.clear')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
