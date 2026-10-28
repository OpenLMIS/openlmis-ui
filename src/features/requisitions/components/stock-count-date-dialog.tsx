import { revalidateLogic } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { parseDateValue } from '@/components/form/date-value';
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

export const stockCountDateSchema = (today: string) =>
  z.object({
    date: z
      .string()
      .min(1, 'stock-events.required')
      .refine(
        (date) => Boolean(parseDateValue(date)) && date <= today,
        'requisitions.edit.date-future',
      ),
  });
export function StockCountDateDialog({
  action,
  today,
  value = '',
  onClose,
  onConfirm,
}: {
  action: 'submit' | 'authorize';
  today: string;
  value?: string;
  onClose: () => void;
  onConfirm: (date: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const form = useAppForm({
    defaultValues: { date: value },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: stockCountDateSchema(today) },
    onSubmit: async ({ value }) => {
      await onConfirm(value.date);
    },
  });
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <FormDialogForm
        onSubmit={() => {
          if (!form.state.isSubmitting) void form.handleSubmit();
        }}
      >
        <FormDialogHeader>
          <FormDialogTitle>{t(`requisitions.edit.stock-count-title.${action}`)}</FormDialogTitle>
          <FormDialogDescription>
            {t('requisitions.edit.stock-count-description')}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <FieldGroup>
            <form.AppField name="date">
              {(field) => (
                <field.DateField
                  label={t('requisitions.edit.stock-count-date')}
                  placeholder={t('requisitions.edit.stock-count-date')}
                  latest={today}
                  required
                />
              )}
            </form.AppField>
          </FieldGroup>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
          <FormDialogSubmit>{t(`requisitions.edit.actions.${action}`)}</FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
    </FormDialog>
  );
}
