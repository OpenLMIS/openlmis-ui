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
  changes: number;
  username: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

/** Asked before leaving the page with unsaved roles. */
export function DiscardChangesDialog({
  open,
  changes,
  username,
  onKeepEditing,
  onDiscard,
}: DiscardChangesDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog onOpenChange={(next) => !next && onKeepEditing()} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('users.roles.discard-title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('users.roles.discard-description', { count: changes, username })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('users.roles.keep-editing')}</AlertDialogCancel>
          <Button onClick={onDiscard} variant="destructive">
            {t('users.roles.discard')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
