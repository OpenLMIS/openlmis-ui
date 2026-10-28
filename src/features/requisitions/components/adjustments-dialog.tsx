import { createColumnHelper, useTable } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { CardRows } from '@/components/card-list';
import {
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DialogTable } from '@/components/dialog-table';
import { SettingsItem } from '@/components/form/settings-list';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import type { RequisitionLine } from '@/features/requisitions/lib/lines';
import type { RequisitionReason } from '@/features/requisitions/lib/requisition';
import { useDialogCardLayout } from '@/hooks/use-card-view';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';

type Adjustment = { reason: string; quantity: number };
const helper = createColumnHelper<DataTableFeatures, Adjustment>();
export function AdjustmentsDialog({
  model,
  reasons,
  unit,
  onClose,
}: {
  model: RequisitionLine;
  reasons: readonly RequisitionReason[];
  unit: QuantityUnit;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { measure, cards } = useDialogCardLayout('table');
  const quantity = (value: number | null | undefined) => (
    <bdi dir="ltr">{cardQuantity(value, model.product?.netContent, unit, i18n.language)}</bdi>
  );
  const table = useTable({
    features: dataTableFeatures,
    columns: helper.columns([
      helper.accessor('reason', {
        header: t('requisitions.adjustments.reason'),
        meta: { label: t('requisitions.adjustments.reason') },
        cell: ({ getValue }) => <bdi>{getValue()}</bdi>,
      }),
      helper.accessor('quantity', {
        header: t('requisitions.adjustments.quantity'),
        meta: { label: t('requisitions.adjustments.quantity') },
        cell: ({ getValue }) => quantity(getValue()),
      }),
    ]),
    data: (model.line.stockAdjustments ?? []).map((item) => ({
      reason: reasons.find((r) => r.id === item.reasonId)?.name ?? item.reasonId,
      quantity: item.quantity,
    })),
  });
  return (
    <FormDialog
      open
      size="table"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4" ref={measure}>
        <FormDialogHeader>
          <FormDialogTitle>{t('requisitions.adjustments.title')}</FormDialogTitle>
          <FormDialogDescription>
            <bdi>{model.product?.fullProductName}</bdi>
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <div className="flex flex-col gap-4">
            <DialogTable
              table={table}
              cards={cards}
              title="reason"
              density="compact"
              layout="auto"
              empty={<DataTableEmpty title={t('requisitions.adjustments.empty')} />}
            />
            {cards ? (
              <div className="shrink-0 overflow-hidden rounded-xl border bg-card">
                <CardRows>
                  <SettingsItem label={<strong>{t('requisitions.requisition.total')}</strong>}>
                    <strong>{quantity(model.line.totalLossesAndAdjustments)}</strong>
                  </SettingsItem>
                </CardRows>
              </div>
            ) : (
              <div className="flex shrink-0 flex-wrap justify-end gap-2 text-sm">
                <span>
                  <strong>{t('requisitions.requisition.total')}</strong>{' '}
                  {quantity(model.line.totalLossesAndAdjustments)}
                </span>
              </div>
            )}
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
        </FormDialogFooter>
      </div>
    </FormDialog>
  );
}
