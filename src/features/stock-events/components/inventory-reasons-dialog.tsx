import { revalidateLogic, useStore } from '@tanstack/react-form';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { CardControlRow, CardRows } from '@/components/card-list';
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
  open?: boolean;
  onOpenChangeComplete?: (open: boolean) => void;
  line: InventoryLine;
  reasons: readonly Reason[];
  unit: QuantityUnit;
  onClose: () => void;
  onUpdate: (adjustments: InventoryAdjustment[]) => void;
};

export function InventoryReasonsDialog({
  open = true,
  onOpenChangeComplete,
  line,
  reasons,
  unit,
  onClose,
  onUpdate,
}: Props) {
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
    <FormDialog
      open={open}
      onOpenChangeComplete={onOpenChangeComplete}
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
              <div className="overflow-hidden rounded-xl border bg-card">
                <CardRows>
                  <CardControlRow label={t('stock-events.reason')}>
                    <addForm.AppField name="reasonId">
                      {(field) => (
                        <field.SelectField
                          label={t('stock-events.reason')}
                          layout="inline"
                          placeholder={t('stock-event-reverse.select-option')}
                          required
                          items={reasons.map((reason) => ({
                            value: reason.id,
                            label: reason.name,
                          }))}
                        />
                      )}
                    </addForm.AppField>
                  </CardControlRow>
                  <CardControlRow
                    label={t('stock-events.quantity')}
                    width={unit === 'PACKS' ? 'wide' : 'half'}
                  >
                    <addForm.AppField name="quantity">
                      {(field) => (
                        <field.QuantityField
                          label={t('stock-events.quantity')}
                          layout="inline"
                          unit={unit}
                          netContent={line.orderable.netContent}
                          dosesLabel={t('quantity-unit.doses')}
                          packsLabel={t('quantity-unit.packs')}
                          notation="plus"
                          sizing={unit === 'PACKS' ? 'fill' : 'full'}
                          required
                        />
                      )}
                    </addForm.AppField>
                  </CardControlRow>
                </CardRows>
              </div>
            </fieldset>
            <Button type="button" variant="outline" onClick={() => void addForm.handleSubmit()}>
              {t('stock-events.add')}
            </Button>
            {adjustments.length > 0 && (
              <div className="overflow-hidden rounded-xl border bg-card">
                <CardRows>
                  {adjustments.map((item, index) => (
                    <CardControlRow
                      key={item.key}
                      label={<bdi>{item.reason.name ?? item.reason.id}</bdi>}
                      width={unit === 'PACKS' ? 'wide' : 'half'}
                    >
                      <div className="flex items-start gap-1">
                        <div className="min-w-0 flex-1">
                          <form.AppField name={`adjustments[${index}].quantity`}>
                            {(field) => (
                              <field.QuantityField
                                label={item.reason.name ?? item.reason.id}
                                layout="inline"
                                unit={unit}
                                netContent={line.orderable.netContent}
                                dosesLabel={t('quantity-unit.doses')}
                                packsLabel={t('quantity-unit.packs')}
                                notation="plus"
                                sizing="fill"
                                required
                              />
                            )}
                          </form.AppField>
                        </div>
                        <Button
                          type="button"
                          variant="destructive-ghost"
                          size="icon-sm"
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
                          <Trash2Icon />
                        </Button>
                      </div>
                    </CardControlRow>
                  ))}
                </CardRows>
              </div>
            )}
            <div className="overflow-hidden rounded-xl border bg-card">
              <CardRows>
                <SettingsItem label={t('physical-inventory.unaccounted')}>
                  <bdi className={difference ? 'text-destructive' : undefined} dir="ltr">
                    {display(difference)}
                  </bdi>
                </SettingsItem>
                <SettingsItem label={<strong>{t('physical-inventory.total')}</strong>}>
                  <strong>
                    <bdi dir="ltr">{display(adjustmentTotal(values()))}</bdi>
                  </strong>
                </SettingsItem>
              </CardRows>
            </div>
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
          <FormDialogSubmit>{t('physical-inventory.update')}</FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
      <FormDialog open={open && confirm} onOpenChange={setConfirm}>
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
    </FormDialog>
  );
}
