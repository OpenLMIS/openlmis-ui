import { revalidateLogic } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAppForm } from '@/components/form/form';
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
import { FieldGroup } from '@/components/ui/field';

type SignatureDialogProps = {
  open: boolean;
  pending: boolean;
  username: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (signature: string) => void | Promise<void>;
};
const signatureSchema = z.object({
  signature: z.string().max(255, 'stock-events.signature-too-long'),
});

export function SignatureDialog({
  open,
  pending,
  username,
  onOpenChange,
  onConfirm,
}: SignatureDialogProps) {
  return (
    <FormDialog
      closeButton={!pending}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      open={open}
    >
      {open && <SignatureForm onConfirm={onConfirm} pending={pending} username={username} />}
    </FormDialog>
  );
}

function SignatureForm({
  pending,
  username,
  onConfirm,
}: Pick<SignatureDialogProps, 'pending' | 'username' | 'onConfirm'>) {
  const { t } = useTranslation();
  const form = useAppForm({
    defaultValues: { signature: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: signatureSchema },
    onSubmit: async ({ value }) => {
      if (!pending) await onConfirm(value.signature);
    },
  });
  return (
    <FormDialogForm
      onSubmit={() => {
        if (!pending && !form.state.isSubmitting) void form.handleSubmit();
      }}
    >
      <FormDialogHeader>
        <FormDialogTitle>{t('stock-events.signature-title')}</FormDialogTitle>
        <FormDialogDescription>
          {t('stock-events.submitted-by', { username })}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <form.AppField name="signature">
            {(field) => (
              <field.TextField dir="auto" disabled={pending} label={t('stock-events.signature')} />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={pending}>{t('stock-events.cancel')}</FormDialogCancel>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <FormDialogSubmit pending={pending || submitting}>
              {t('stock-events.confirm')}
            </FormDialogSubmit>
          )}
        </form.Subscribe>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
