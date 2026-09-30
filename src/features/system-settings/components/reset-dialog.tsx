import { Loader2Icon, RotateCcwIcon } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { WorkspaceActionsPortal } from '@/components/workspace-tabs';

type ResetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
};

export function ResetDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: ResetDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog onOpenChange={(next) => !pending && onOpenChange(next)} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <RotateCcwIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('dialog.cancel')}</AlertDialogCancel>
          <Button
            disabled={pending}
            focusableWhenDisabled
            onClick={onConfirm}
            variant="destructive"
          >
            {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type ResetActionProps = {
  label: string;
  disabled: boolean;
  onClick: () => void;
};

export function ResetAction({ label, disabled, onClick }: ResetActionProps) {
  return (
    <WorkspaceActionsPortal>
      <Button
        disabled={disabled}
        focusableWhenDisabled
        onClick={onClick}
        size="lg"
        type="button"
        variant="outline"
      >
        <RotateCcwIcon data-icon="inline-start" />
        {label}
      </Button>
    </WorkspaceActionsPortal>
  );
}
