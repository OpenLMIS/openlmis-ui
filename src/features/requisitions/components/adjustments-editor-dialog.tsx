import { revalidateLogic, useStore } from '@tanstack/react-form';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { CardActions } from '@/components/card-actions';
import {
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DialogTable } from '@/components/dialog-table';
import { useAppForm } from '@/components/form/form';
import { quantityValue } from '@/components/form/quantity-value';
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
import { Button } from '@/components/ui/button';
import { AdjustmentsDialog } from '@/features/requisitions/components/adjustments-dialog';
import type { RequisitionLine } from '@/features/requisitions/lib/lines';
import type {
  RequisitionLineItem,
  RequisitionReason,
} from '@/features/requisitions/lib/requisition';
import { useDialogCardLayout } from '@/hooks/use-card-view';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

type Adjustment = NonNullable<RequisitionLineItem['stockAdjustments']>[number];
export const adjustmentQuantitySchema = wholeNumberText(
  {
    required: 'stock-events.required',
    invalid: 'requisitions.edit.adjustment-positive',
    tooLarge: 'stock-events.number-too-large',
  },
  { min: { value: 1, tooSmall: 'requisitions.edit.adjustment-positive' } },
);
export const availableAdjustmentReasons = (
  reasons: readonly RequisitionReason[],
  adjustments: readonly Adjustment[],
) =>
  reasons.filter(
    (reason) => !reason.hidden && !adjustments.some((item) => item.reasonId === reason.reasonId),
  );
export const adjustmentTotal = (
  adjustments: readonly Adjustment[],
  reasons: readonly RequisitionReason[],
) =>
  adjustments.reduce((total, item) => {
    const reason = reasons.find((reason) => reason.reasonId === item.reasonId);
    return total + (reason ? item.quantity * (reason.reasonType === 'CREDIT' ? 1 : -1) : 0);
  }, 0);
export type AdjustmentsEditorDialogProps = {
  model: RequisitionLine;
  reasons: readonly RequisitionReason[];
  unit: QuantityUnit;
  readOnly?: boolean;
  onSave: (adjustments: Adjustment[]) => void;
  onClose: () => void;
};
export function AdjustmentsEditorDialog(props: AdjustmentsEditorDialogProps) {
  return props.readOnly ? <AdjustmentsDialog {...props} /> : <Editor {...props} />;
}
const helper = createColumnHelper<DataTableFeatures, Adjustment & { index: number }>();
function Editor({ model, reasons, unit, onSave, onClose }: AdjustmentsEditorDialogProps) {
  const { t, i18n } = useTranslation();
  const { measure, cards } = useDialogCardLayout('table');
  const [initial] = useState(() => ({
    adjustments: (model.line.stockAdjustments ?? []).map((item) => ({
      reasonId: item.reasonId,
      quantity: quantityValue(String(item.quantity), model.product?.netContent),
    })),
  }));
  const schema = z.object({
    doses: adjustmentQuantitySchema,
    packs: z.string(),
    remainder: z.string(),
  });
  const form = useAppForm({
    defaultValues: initial,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: z.object({
        adjustments: z.array(z.object({ reasonId: z.string(), quantity: schema })),
      }),
    },
    onSubmit: ({ value }) =>
      onSave(
        value.adjustments.map((item) => ({
          reasonId: item.reasonId,
          quantity: toWholeNumber(item.quantity.doses),
        })),
      ),
  });
  const items = useStore(form.store, (state) => state.values.adjustments);
  const adjustments = items.map((item, index) => ({
    reasonId: item.reasonId,
    quantity: toWholeNumber(item.quantity.doses),
    index,
  }));
  const offered = availableAdjustmentReasons(reasons, adjustments);
  const add = useAppForm({
    defaultValues: { reasonId: '', quantity: quantityValue() },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: z.object({
        reasonId: z.string().min(1, 'stock-events.required'),
        quantity: schema,
      }),
    },
    onSubmit: ({ value }) => {
      if (!offered.some((r) => r.reasonId === value.reasonId)) return;
      form.setFieldValue('adjustments', (current) => [...current, value]);
      add.reset();
    },
  });
  const columns = useMemo(() => {
    const reasonName = (id: string) => reasons.find((r) => r.reasonId === id)?.name ?? id;
    return helper.columns([
      helper.accessor('reasonId', {
        id: 'reason',
        header: t('requisitions.adjustments.reason'),
        meta: { label: t('requisitions.adjustments.reason') },
        cell: ({ getValue }) => <bdi>{reasonName(getValue())}</bdi>,
      }),
      helper.accessor('quantity', {
        header: t('requisitions.adjustments.quantity'),
        meta: { label: t('requisitions.adjustments.quantity') },
        cell: ({ row }) => (
          <form.AppField name={`adjustments[${row.original.index}].quantity`}>
            {(field) => (
              <field.QuantityField
                label={reasonName(row.original.reasonId)}
                layout="inline"
                unit={unit}
                netContent={model.product?.netContent}
                dosesLabel={t('quantity-unit.doses')}
                packsLabel={t('quantity-unit.packs')}
                notation="plus"
                required
              />
            )}
          </form.AppField>
        ),
      }),
      helper.display({
        id: 'actions',
        header: t('stock-events.actions'),
        cell: ({ row }) => (
          <CardActions
            label={t('card-actions.actions-for', { name: reasonName(row.original.reasonId) })}
            actions={[
              {
                id: 'remove',
                label: t('stock-events.remove'),
                icon: <Trash2Icon />,
                destructive: true,
                onSelect: () =>
                  form.setFieldValue('adjustments', (current) =>
                    current.filter((_, index) => index !== row.original.index),
                  ),
              },
            ]}
          />
        ),
      }),
    ]);
  }, [t, reasons, unit, model.product?.netContent, form]);
  const table = useTable({ features: dataTableFeatures, data: adjustments, columns });
  return (
    <FormDialog
      open
      size="table"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4" ref={measure}>
        <FormDialogForm onSubmit={() => void form.handleSubmit()}>
          <FormDialogHeader>
            <FormDialogTitle>{t('requisitions.adjustments.title')}</FormDialogTitle>
            <FormDialogDescription>
              <bdi>{model.product?.fullProductName}</bdi>
            </FormDialogDescription>
          </FormDialogHeader>
          <FormDialogBody>
            <div className="flex flex-col gap-4">
              <fieldset
                className={cards ? 'flex flex-col gap-3' : 'flex items-end gap-3'}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
                    event.preventDefault();
                    event.stopPropagation();
                    void add.handleSubmit();
                  }
                }}
              >
                <div className="min-w-0 flex-1">
                  <add.AppField name="reasonId">
                    {(field) => (
                      <field.SelectField
                        label={t('requisitions.adjustments.reason')}
                        placeholder={t('stock-event-reverse.select-option')}
                        items={offered.map((r) => ({
                          value: r.reasonId,
                          label: r.name ?? r.reasonId,
                        }))}
                        required
                      />
                    )}
                  </add.AppField>
                </div>
                <div className="min-w-0 flex-1">
                  <add.AppField name="quantity">
                    {(field) => (
                      <field.QuantityField
                        label={t('requisitions.adjustments.quantity')}
                        unit={unit}
                        netContent={model.product?.netContent}
                        dosesLabel={t('quantity-unit.doses')}
                        packsLabel={t('quantity-unit.packs')}
                        notation="plus"
                        required
                      />
                    )}
                  </add.AppField>
                </div>
                <Button type="button" variant="secondary" onClick={() => void add.handleSubmit()}>
                  <PlusIcon />
                  {t('stock-events.add')}
                </Button>
              </fieldset>
              <DialogTable
                table={table}
                cards={cards}
                title="reason"
                density="compact"
                layout="auto"
                empty={<DataTableEmpty title={t('requisitions.adjustments.empty')} />}
              />
              <div className="flex justify-end gap-2 text-sm">
                <strong>{t('requisitions.requisition.total')}</strong>
                <bdi dir="ltr">
                  {cardQuantity(
                    adjustmentTotal(adjustments, reasons),
                    model.product?.netContent,
                    unit,
                    i18n.language,
                  )}
                </bdi>
              </div>
            </div>
          </FormDialogBody>
          <FormDialogFooter>
            <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
            <FormDialogSubmit>{t('requisitions.edit.update')}</FormDialogSubmit>
          </FormDialogFooter>
        </FormDialogForm>
      </div>
    </FormDialog>
  );
}
