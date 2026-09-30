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

type DiscardChangesDialogProps = {
  open: boolean;
  /** What is about to be lost, e.g. how many changes to whose roles. */
  description: string;
  /** Whether discarding also signs out, rather than leaving the page. */
  signingOut: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

export function DiscardChangesDialog({
  open,
  description,
  signingOut,
  onKeepEditing,
  onDiscard,
}: DiscardChangesDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog onOpenChange={(next) => !next && onKeepEditing()} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('discard-changes.title')}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('discard-changes.keep-editing')}</AlertDialogCancel>
          <Button onClick={onDiscard} variant="destructive">
            {t(signingOut ? 'discard-changes.discard-sign-out' : 'discard-changes.discard')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
