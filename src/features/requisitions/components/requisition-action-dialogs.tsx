import { Loader2Icon, Trash2Icon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionTooltip } from '@/components/action-tooltip';
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
import type { RequisitionAction } from '@/features/requisitions/lib/capabilities';
import type { RequisitionFailure } from '@/features/requisitions/lib/failure';
import { useOnline } from '@/lib/online';

type ConfirmAction =
  | Extract<RequisitionAction, 'submit' | 'submitAndAuthorize' | 'authorize' | 'skip' | 'delete'>
  | 'update';
type RequisitionActionDialogProps = {
  action: ConfirmAction;
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
  const title = t(
    `requisitions.edit.actions.${action === 'submitAndAuthorize' ? 'submit-and-authorize' : action}`,
  );
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
              `requisitions.edit.actions.${action === 'submitAndAuthorize' ? 'submit' : action}-confirm`,
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
type RequisitionErrorDialogProps = {
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
  const online = useOnline();
  const reason = online ? undefined : t('offline.action-description');
  return (
    <InvalidSubmitDialog
      open
      title={t('requisitions.edit.error-title')}
      description={
        error.kind === 'server'
          ? (error.message ?? t('requisitions.edit.error-description'))
          : t(`requisitions.edit.error.${error.kind}`)
      }
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogCancel disabled={pending}>{t('dialog.close')}</AlertDialogCancel>
      {update && (
        <ActionTooltip reason={reason}>
          <AlertDialogAction
            disabled={pending || !online}
            focusableWhenDisabled={pending || !online}
            aria-description={reason}
            onClick={() => {
              if (!pending && online) onUpdate();
            }}
          >
            {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {t('requisitions.edit.update')}
          </AlertDialogAction>
        </ActionTooltip>
      )}
    </InvalidSubmitDialog>
  );
}
export function RequisitionValidationDialog({
  allSkipped = false,
  onClose,
  finalFocus,
}: {
  allSkipped?: boolean;
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
          ? t('requisitions.edit.validation.all-skipped')
          : t('requisitions.edit.validation-description')
      }
      closeLabel={t('dialog.close')}
      finalFocus={finalFocus}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    />
  );
}
