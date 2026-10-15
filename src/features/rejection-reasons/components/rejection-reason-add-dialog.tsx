import { useIsMutating } from '@tanstack/react-query';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { FieldGroup } from '@/components/ui/field';
import { RejectionReasonFields } from '@/features/rejection-reasons/components/rejection-reason-fields';
import {
  rejectionReasonSaveKey,
  useRejectionReasonForm,
} from '@/features/rejection-reasons/components/use-rejection-reason-form';

export function RejectionReasonAddDialog({
  target,
  onClose,
}: {
  target: 'new' | undefined;
  onClose: () => void;
}) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const pending = useIsMutating({ mutationKey: rejectionReasonSaveKey }) > 0;
  return (
    <FormDialog {...dialogProps(pending)}>
      {shown && <RejectionReasonAddForm onSaved={close} />}
    </FormDialog>
  );
}

function RejectionReasonAddForm({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation();
  const fields = useRef<HTMLDivElement>(null);
  const { form, save, categoryReady } = useRejectionReasonForm({
    onSaved: (reason) => {
      toast.success(t('rejection-reasons.form.saved-title'), {
        description: t('rejection-reasons.form.saved', { name: reason.name }),
      });
      onSaved();
    },
    onInvalid: () =>
      requestAnimationFrame(() =>
        fields.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      ),
  });
  const disabled = save.isPending || save.isSuccess;
  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{t('rejection-reasons.form.create-title')}</FormDialogTitle>
        <FormDialogDescription>{t('rejection-reasons.form.description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <div ref={fields}>
          <FieldGroup>
            {save.isError && (
              <ErrorAlert
                title={t('rejection-reasons.form.save-error-title')}
                description={serverMessage(save.error) ?? t('rejection-reasons.form.save-error')}
              />
            )}
            <RejectionReasonFields form={form} disabled={disabled} />
          </FieldGroup>
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled={save.isSuccess || !categoryReady} pending={save.isPending}>
          {t('rejection-reasons.form.save')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
