import { revalidateLogic } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { toDateValue } from '@/components/form/date-value';
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
import { inventoryLotSchema } from '@/features/stock-events/lib/physical-inventory-products';
import type {
  InventoryLine,
  InventoryStockLine,
} from '@/features/stock-events/lib/physical-inventory-types';

type Props = {
  line: InventoryLine;
  listed: readonly InventoryStockLine[];
  onClose: () => void;
  onUpdate: (lot: NonNullable<InventoryLine['newLot']>) => void;
};
export function InventoryEditLotDialog({ line, listed, onClose, onUpdate }: Props) {
  const { t } = useTranslation();
  const today = toDateValue(new Date());
  const form = useAppForm({
    defaultValues: {
      lotCode: line.newLot?.lotCode ?? '',
      expirationDate: line.newLot?.expirationDate ?? '',
    },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: inventoryLotSchema(line.orderable.id, listed, today, line.key) },
    onSubmit: ({ value }) => {
      if (line.newLot)
        onUpdate({
          ...line.newLot,
          lotCode: value.lotCode.trim(),
          expirationDate: value.expirationDate || null,
        });
    },
  });
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <FormDialogForm onSubmit={() => void form.handleSubmit()}>
        <FormDialogHeader>
          <FormDialogTitle>{t('physical-inventory.edit-lot')}</FormDialogTitle>
          <FormDialogDescription>
            {t('physical-inventory.edit-lot-description')}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <FieldGroup>
            <form.AppField name="lotCode">
              {(field) => (
                <field.TextField label={t('stock-events.lot-code')} dir="auto" required />
              )}
            </form.AppField>
            <form.AppField name="expirationDate">
              {(field) => (
                <field.DateField
                  label={t('stock-events.expiry-date')}
                  placeholder={t('stock-events.expiry-date')}
                  earliest={today}
                  clearLabel={t('stock-events.clear')}
                />
              )}
            </form.AppField>
          </FieldGroup>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
          <FormDialogSubmit>{t('physical-inventory.update')}</FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
    </FormDialog>
  );
}
