import { Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
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

type SettingsResetProps = {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  disabled: boolean;
  pending: boolean;
  onConfirm: () => Promise<void>;
};

export function SettingsReset({
  label,
  title,
  description,
  confirmLabel,
  disabled,
  pending,
  onConfirm,
}: SettingsResetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <WorkspaceActionsPortal>
        <Button
          disabled={disabled}
          focusableWhenDisabled
          onClick={() => setOpen(true)}
          size="lg"
          type="button"
          variant="outline"
        >
          <RotateCcwIcon data-icon="inline-start" />
          {label}
        </Button>
      </WorkspaceActionsPortal>
      <AlertDialog onOpenChange={(next) => !pending && setOpen(next)} open={open}>
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
              onClick={() => void onConfirm().finally(() => setOpen(false))}
              variant="destructive"
            >
              {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
