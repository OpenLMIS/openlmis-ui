import { useTranslation } from 'react-i18next';
import {
  FormDialog,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { productName } from '@/features/reference-data/lib/product-name';
import { inventoryLotCode } from '@/features/stock-events/lib/physical-inventory-lines';
import { canDeactivateInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';
import type { InventoryLine } from '@/features/stock-events/lib/physical-inventory-types';

export function InventoryDeactivateDialog({
  line,
  pending,
  online,
  onClose,
  onConfirm,
}: {
  line: InventoryLine;
  pending: boolean;
  online: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
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
          if (!pending && canDeactivateInventoryLine(line, online)) onConfirm();
        }}
      >
        <FormDialogHeader>
          <FormDialogTitle>{t('physical-inventory.deactivate')}</FormDialogTitle>
          <FormDialogDescription>
            {t('physical-inventory.deactivate-confirm', {
              product: productName(line.orderable),
              lot: inventoryLotCode(line) ?? t('stock-events.no-lot-defined'),
            })}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogFooter>
          <FormDialogCancel disabled={pending}>{t('stock-events.cancel')}</FormDialogCancel>
          <FormDialogSubmit pending={pending} disabled={!canDeactivateInventoryLine(line, online)}>
            {t('physical-inventory.deactivate')}
          </FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
    </FormDialog>
  );
}
