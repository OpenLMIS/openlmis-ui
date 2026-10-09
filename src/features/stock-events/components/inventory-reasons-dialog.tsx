import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
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
import { FieldGroup } from '@/components/ui/field';
import { productName } from '@/features/reference-data/lib/product-name';
import type { Reason } from '@/features/reference-data/lib/types';
import { adjustmentTotal, unaccounted } from '@/features/stock-events/lib/physical-inventory-form';
import { inventoryFormats } from '@/features/stock-events/lib/physical-inventory-format';
import { inventoryLotCode } from '@/features/stock-events/lib/physical-inventory-lines';
import type {
  InventoryAdjustment,
  InventoryLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import type { QuantityUnit } from '@/lib/quantity';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

const positive = wholeNumberText(
  {
    required: 'stock-events.required',
    invalid: 'physical-inventory.reason-positive',
    tooLarge: 'stock-events.number-too-large',
  },
  { min: { value: 1, tooSmall: 'physical-inventory.reason-positive' } },
);
const quantitySchema = z.object({ doses: positive, packs: z.string(), remainder: z.string() });
type Props = {
  line: InventoryLine;
  reasons: readonly Reason[];
  unit: QuantityUnit;
  onClose: () => void;
  onUpdate: (adjustments: InventoryAdjustment[]) => void;
};

export function InventoryReasonsDialog({ line, reasons, unit, onClose, onUpdate }: Props) {
  const { t, i18n } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const form = useAppForm({
    defaultValues: {
      adjustments: [...line.stockAdjustments].reverse().map((item) => ({
        key: String(crypto.randomUUID()),
        reason: item.reason,
        quantity: quantityValue(String(item.quantity), line.orderable.netContent),
      })),
    },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: z.object({
        adjustments: z.array(
          z.object({
            key: z.string(),
            reason: z.object({
              id: z.string(),
              name: z.string().optional(),
              reasonType: z.string().optional(),
            }),
            quantity: quantitySchema,
          }),
        ),
      }),
    },
    onSubmit: () => {
      if (difference !== 0) setConfirm(true);
      else apply();
    },
  });
  const addForm = useAppForm({
    defaultValues: { reasonId: '', quantity: quantityValue() },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: z.object({
        reasonId: z.string().min(1, 'stock-events.required'),
        quantity: quantitySchema,
      }),
    },
    onSubmit: ({ value }) => {
      const reason = reasons.find((item) => item.id === value.reasonId);
      if (!reason) return;
      form.setFieldValue('adjustments', (current) => [
        { key: String(crypto.randomUUID()), reason, quantity: value.quantity },
        ...current,
      ]);
      addForm.reset();
    },
  });
  const adjustments = useStore(form.store, (state) => state.values.adjustments);
  const values = () =>
    form.state.values.adjustments
      .map((item) => ({ reason: item.reason, quantity: toWholeNumber(item.quantity.doses) }))
      .reverse();
  const difference = unaccounted({ ...line, stockAdjustments: values() });
  const display = (value: number | null) =>
    inventoryFormats(i18n.language).quantity(value, line.orderable.netContent, unit);
  const product = productName(line.orderable);
  const apply = () => {
    onUpdate(values());
    setConfirm(false);
  };
  return (
    <>
      <FormDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <FormDialogForm onSubmit={() => void form.handleSubmit()}>
          <FormDialogHeader>
            <FormDialogTitle>{t('physical-inventory.reasons-title', { product })}</FormDialogTitle>
            <FormDialogDescription>
              {t('physical-inventory.reasons-difference', {
                difference: display(unaccounted({ ...line, stockAdjustments: [] })),
              })}
            </FormDialogDescription>
          </FormDialogHeader>
          <FormDialogBody>
            <div className="flex flex-col gap-4">
              <fieldset
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    event.target instanceof HTMLInputElement &&
                    !event.defaultPrevented
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    void addForm.handleSubmit();
                  }
                }}
              >
                <FieldGroup>
                  <addForm.AppField name="reasonId">
                    {(field) => (
                      <field.SelectField
                        label={t('stock-events.reason')}
                        required
                        items={reasons.map((reason) => ({ value: reason.id, label: reason.name }))}
                      />
                    )}
                  </addForm.AppField>
                  <addForm.AppField name="quantity">
                    {(field) => (
                      <field.QuantityField
                        label={t('stock-events.quantity')}
                        unit={unit}
                        netContent={line.orderable.netContent}
                        dosesLabel={t('quantity-unit.doses')}
                        packsLabel={t('quantity-unit.packs')}
                        required
                      />
                    )}
                  </addForm.AppField>
                </FieldGroup>
              </fieldset>
              <Button type="button" onClick={() => void addForm.handleSubmit()}>
                {t('stock-events.add')}
              </Button>
              {adjustments.map((item, index) => (
                <div className="flex items-start gap-2" key={item.key}>
                  <div className="min-w-0 flex-1">
                    <form.AppField name={`adjustments[${index}].quantity`}>
                      {(field) => (
                        <field.QuantityField
                          label={item.reason.name ?? item.reason.id}
                          unit={unit}
                          netContent={line.orderable.netContent}
                          dosesLabel={t('quantity-unit.doses')}
                          packsLabel={t('quantity-unit.packs')}
                          required
                        />
                      )}
                    </form.AppField>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={t('stock-events.field-of', {
                      field: t('stock-events.remove'),
                      row: `${product} ${inventoryLotCode(line) ?? t('stock-events.no-lot-defined')} ${item.reason.name ?? item.reason.id}`,
                    })}
                    onClick={() =>
                      form.setFieldValue('adjustments', (current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    {t('stock-events.remove')}
                  </Button>
                </div>
              ))}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt>{t('physical-inventory.unaccounted')}</dt>
                <dd>
                  <bdi>{display(difference)}</bdi>
                </dd>
                <dt>{t('physical-inventory.total')}</dt>
                <dd>
                  <bdi>{display(adjustmentTotal(values()))}</bdi>
                </dd>
              </dl>
            </div>
          </FormDialogBody>
          <FormDialogFooter>
            <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
            <FormDialogSubmit>{t('physical-inventory.update')}</FormDialogSubmit>
          </FormDialogFooter>
        </FormDialogForm>
      </FormDialog>
      <FormDialog open={confirm} onOpenChange={setConfirm}>
        {confirm && (
          <FormDialogForm onSubmit={apply}>
            <FormDialogHeader>
              <FormDialogTitle>{t('physical-inventory.update')}</FormDialogTitle>
              <FormDialogDescription>
                {t('physical-inventory.reasons-confirm', { product })}
              </FormDialogDescription>
            </FormDialogHeader>
            <FormDialogFooter>
              <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
              <FormDialogSubmit>{t('stock-events.confirm')}</FormDialogSubmit>
            </FormDialogFooter>
          </FormDialogForm>
        )}
      </FormDialog>
    </>
  );
}
