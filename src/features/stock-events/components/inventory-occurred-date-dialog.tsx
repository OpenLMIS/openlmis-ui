import { revalidateLogic } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { parseDateValue, toDateValue } from '@/components/form/date-value';
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

export const inventoryOccurredSchema = (today: string) =>
  z.object({
    occurredDate: z
      .string()
      .min(1, 'stock-events.required')
      .refine((date) => Boolean(parseDateValue(date)) && date <= today, 'stock-events.date-future'),
    signature: z.string().max(255, 'stock-events.signature-too-long'),
  });
export function InventoryOccurredDateDialog({
  pending,
  username,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  username: string;
  onClose: () => void;
  onConfirm: (value: { occurredDate: string; signature: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const today = toDateValue(new Date());
  const form = useAppForm({
    defaultValues: { occurredDate: today, signature: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: inventoryOccurredSchema(today) },
    onSubmit: async ({ value }) => {
      if (!pending) await onConfirm(value);
    },
  });
  return (
    <FormDialog
      open
      closeButton={!pending}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <FormDialogForm
        onSubmit={() => {
          if (!pending && !form.state.isSubmitting) void form.handleSubmit();
        }}
      >
        <FormDialogHeader>
          <FormDialogTitle>{t('physical-inventory.occurred-title')}</FormDialogTitle>
          <FormDialogDescription>
            {t('physical-inventory.submitted-by', { username })}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <FieldGroup>
            <form.AppField name="occurredDate">
              {(field) => (
                <field.DateField
                  label={t('physical-inventory.occurred-date')}
                  placeholder={t('physical-inventory.occurred-date')}
                  latest={today}
                  required
                  disabled={pending}
                />
              )}
            </form.AppField>
            <form.AppField name="signature">
              {(field) => (
                <field.TextField
                  label={t('stock-events.signature')}
                  dir="auto"
                  disabled={pending}
                />
              )}
            </form.AppField>
          </FieldGroup>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel disabled={pending}>{t('stock-events.cancel')}</FormDialogCancel>
          <FormDialogSubmit pending={pending}>{t('stock-events.confirm')}</FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
    </FormDialog>
  );
}
