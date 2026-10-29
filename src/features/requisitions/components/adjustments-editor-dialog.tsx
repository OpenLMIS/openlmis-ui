import { revalidateLogic, useStore } from '@tanstack/react-form';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { CardActions } from '@/components/card-actions';
import { CardRows } from '@/components/card-list';
import {
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DialogTable } from '@/components/dialog-table';
import { useAppForm } from '@/components/form/form';
import { quantityValue } from '@/components/form/quantity-value';
import { SettingsItem } from '@/components/form/settings-list';
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
import { adjustmentQuantitySchema, adjustmentTotal } from '@/features/requisitions/lib/adjustments';
import type { RequisitionLine } from '@/features/requisitions/lib/lines';
import type {
  RequisitionLineItem,
  RequisitionReason,
} from '@/features/requisitions/lib/requisition';
import { useDialogCardLayout } from '@/hooks/use-card-view';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { toWholeNumber } from '@/lib/whole-number';

type Adjustment = NonNullable<RequisitionLineItem['stockAdjustments']>[number];
export const availableAdjustmentReasons = (
  reasons: readonly RequisitionReason[],
  adjustments: readonly Adjustment[],
) =>
  reasons.filter(
    (reason) => !reason.hidden && !adjustments.some((item) => item.reasonId === reason.id),
  );
type AdjustmentsEditorDialogProps = {
  model: RequisitionLine;
  reasons: readonly RequisitionReason[];
  unit: QuantityUnit;
  onSave: (adjustments: Adjustment[]) => void;
  onClose: () => void;
};
const helper = createColumnHelper<DataTableFeatures, Adjustment & { index: number }>();
export function AdjustmentsEditorDialog({
  model,
  reasons,
  unit,
  onSave,
  onClose,
}: AdjustmentsEditorDialogProps) {
  const { t, i18n } = useTranslation();
  const region = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const [focusReason, setFocusReason] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (focusReason === null) return;
    const target = Array.from(
      region.current?.querySelectorAll<HTMLButtonElement>('button[aria-label]') ?? [],
    ).find((button) => button.getAttribute('aria-label') === focusReason);
    (target ?? addButton.current)?.focus();
    setFocusReason(null);
  }, [focusReason]);
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
      if (!offered.some((r) => r.id === value.reasonId)) return;
      form.setFieldValue('adjustments', (current) => [value, ...current]);
      add.reset();
    },
  });
  const columns = useMemo(() => {
    const reasonName = (id: string) => reasons.find((r) => r.id === id)?.name ?? id;
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
                label={`${t('requisitions.adjustments.quantity')}: ${reasonName(row.original.reasonId)}`}
                layout="inline"
                hideErrors={!cards}
                sizing={cards ? 'fill' : undefined}
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
        cell: ({ row }) => {
          const name = reasonName(row.original.reasonId);
          const removeName = t('stock-events.field-of', {
            field: t('stock-events.remove'),
            row: name,
          });
          const remove = () => {
            const remaining = form.state.values.adjustments.filter(
              (_, index) => index !== row.original.index,
            );
            const next = remaining[Math.min(row.original.index, remaining.length - 1)];
            setFocusReason(
              next
                ? t('stock-events.field-of', {
                    field: t('stock-events.remove'),
                    row: reasonName(next.reasonId),
                  })
                : '',
            );
            form.setFieldValue('adjustments', (current) =>
              current.filter((_, index) => index !== row.original.index),
            );
          };
          return cards ? (
            <CardActions
              label={t('card-actions.actions-for', { name })}
              actions={[
                {
                  id: 'remove',
                  label: t('stock-events.remove'),
                  name: removeName,
                  icon: <Trash2Icon />,
                  destructive: true,
                  onSelect: remove,
                },
              ]}
            />
          ) : (
            <Button
              type="button"
              variant="destructive-ghost"
              size="icon-sm"
              aria-label={removeName}
              onClick={remove}
            >
              <Trash2Icon />
            </Button>
          );
        },
      }),
    ]);
  }, [t, reasons, unit, model.product?.netContent, form, cards]);
  const table = useTable({ features: dataTableFeatures, data: adjustments, columns });
  const total = (
    <bdi dir="ltr">
      {cardQuantity(
        adjustmentTotal(adjustments, reasons),
        model.product?.netContent,
        unit,
        i18n.language,
      )}
    </bdi>
  );
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
            <div className="flex flex-col gap-4" ref={region}>
              <fieldset
                className={cards ? 'flex flex-col gap-3' : 'flex items-start gap-3'}
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
                          value: r.id,
                          label: r.name ?? r.id,
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
                <div className="flex flex-col gap-1">
                  {!cards && (
                    <span aria-hidden className="invisible text-sm leading-snug">
                      &nbsp;
                    </span>
                  )}
                  <Button
                    ref={addButton}
                    type="button"
                    variant="secondary"
                    onClick={() => void add.handleSubmit()}
                  >
                    <PlusIcon />
                    {t('stock-events.add')}
                  </Button>
                </div>
              </fieldset>
              <DialogTable
                table={table}
                cards={cards}
                title="reason"
                density="compact"
                layout="auto"
                empty={
                  <DataTableEmpty
                    title={t('requisitions.adjustments.empty')}
                    description={t('requisitions.adjustments.empty-description')}
                  />
                }
              />
              {cards ? (
                <div className="shrink-0 overflow-hidden rounded-xl border bg-card">
                  <CardRows>
                    <SettingsItem label={<strong>{t('requisitions.requisition.total')}</strong>}>
                      <strong>{total}</strong>
                    </SettingsItem>
                  </CardRows>
                </div>
              ) : (
                <div className="flex justify-end gap-2 text-sm">
                  <strong>{t('requisitions.requisition.total')}</strong>
                  {total}
                </div>
              )}
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
