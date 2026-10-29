import { useTranslation } from 'react-i18next';
import { PageVisibility } from '@/components/app-shell/page-visibility';
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
  title?: string;
  actionLabel?: string;
  pending?: boolean;
  /** What is about to be lost, e.g. how many changes to whose roles. */
  description: string;
  /** Whether discarding also signs out, rather than leaving the page. */
  signingOut: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

export function DiscardChangesDialog({
  open,
  title,
  actionLabel,
  pending = false,
  description,
  signingOut,
  onKeepEditing,
  onDiscard,
}: DiscardChangesDialogProps) {
  const { t } = useTranslation();
  return (
    <PageVisibility hidden={false}>
      <AlertDialog onOpenChange={(next) => !next && !pending && onKeepEditing()} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title ?? t('discard-changes.title')}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t('discard-changes.keep-editing')}
            </AlertDialogCancel>
            <Button disabled={pending} onClick={onDiscard} variant="destructive">
              {actionLabel ??
                t(signingOut ? 'discard-changes.discard-sign-out' : 'discard-changes.discard')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageVisibility>
  );
}
