import { revalidateLogic } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
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
import { InventoryLotFields } from '@/features/stock-events/components/inventory-lot-fields';
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
      productId: line.orderable.id,
      lotId: line.key,
      lotCode: line.newLot?.lotCode ?? '',
      expirationDate: line.newLot?.expirationDate ?? '',
    },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: inventoryLotSchema(line.orderable.id, listed, today, line.key).extend({
        productId: z.string(),
        lotId: z.string(),
      }),
    },
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
            <InventoryLotFields form={form} today={today} />
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
