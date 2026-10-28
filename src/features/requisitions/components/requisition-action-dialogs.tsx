import { Loader2Icon, Trash2Icon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { InvalidSubmitDialog } from '@/components/invalid-submit-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type RequisitionAction = 'submit' | 'submit-and-authorize' | 'authorize' | 'skip' | 'delete';
export type RequisitionActionDialogProps = {
  action: RequisitionAction;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};
export function RequisitionActionDialog({
  action,
  pending = false,
  onConfirm,
  onClose,
}: RequisitionActionDialogProps) {
  const { t } = useTranslation();
  const title = t(`requisitions.edit.actions.${action}`);
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          {action === 'delete' && (
            <AlertDialogMedia variant="destructive">
              <Trash2Icon />
            </AlertDialogMedia>
          )}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              `requisitions.edit.actions.${action === 'submit-and-authorize' ? 'submit' : action}-confirm`,
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('dialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant={action === 'delete' ? 'destructive' : 'default'}
            disabled={pending}
            focusableWhenDisabled={pending}
            onClick={() => {
              if (!pending) onConfirm();
            }}
          >
            {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {title}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export type RequisitionFailure =
  | { kind: 'server'; message: string }
  | { kind: 'forbidden' }
  | { kind: 'conflict' }
  | { kind: 'key-used' };
export type RequisitionErrorDialogProps = {
  error: RequisitionFailure;
  pending?: boolean;
  onClose: () => void;
  onUpdate: () => void;
};
export function RequisitionErrorDialog({
  error,
  pending = false,
  onClose,
  onUpdate,
}: RequisitionErrorDialogProps) {
  const { t } = useTranslation();
  const update = error.kind !== 'server';
  return (
    <InvalidSubmitDialog
      open
      title={t('requisitions.edit.error-title')}
      description={
        error.kind === 'server' ? error.message : t(`requisitions.edit.error.${error.kind}`)
      }
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogCancel disabled={pending}>{t('dialog.close')}</AlertDialogCancel>
      {update && (
        <AlertDialogAction
          disabled={pending}
          focusableWhenDisabled={pending}
          onClick={() => {
            if (!pending) onUpdate();
          }}
        >
          {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('requisitions.edit.update')}
        </AlertDialogAction>
      )}
    </InvalidSubmitDialog>
  );
}
export function RequisitionValidationDialog({
  allSkipped = false,
  description,
  onClose,
  finalFocus,
}: {
  allSkipped?: boolean;
  description?: ReactNode;
  onClose: () => void;
  finalFocus?: ComponentProps<typeof InvalidSubmitDialog>['finalFocus'];
}) {
  const { t } = useTranslation();
  return (
    <InvalidSubmitDialog
      open
      title={t('requisitions.edit.validation-title')}
      description={
        allSkipped
          ? t('requisitions.edit.all-skipped')
          : (description ?? t('requisitions.edit.validation-description'))
      }
      closeLabel={t('dialog.close')}
      finalFocus={finalFocus}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    />
  );
}
