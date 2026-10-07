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

type ClearLinesDialogProps = {
  open: boolean;
  count: number;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
};

export function ClearLinesDialog({ open, count, onOpenChange, onClear }: ClearLinesDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('stock-events.clear-title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('stock-events.clear-description', { count })}
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
