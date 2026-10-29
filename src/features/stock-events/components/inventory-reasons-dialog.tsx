import { revalidateLogic, useStore } from '@tanstack/react-form';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableHeaderLabel } from '@/components/data-table/data-table';
import { CardActions } from '@/components/display/card-actions';
import { CardControlRow, CardRows } from '@/components/display/card-list';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { productName } from '@/features/reference-data/lib/product-name';
import type { Reason } from '@/features/reference-data/lib/types';
import { adjustmentTotal, unaccounted } from '@/features/stock-events/lib/physical-inventory-form';
import { inventoryFormats } from '@/features/stock-events/lib/physical-inventory-format';
import { inventoryLotCode } from '@/features/stock-events/lib/physical-inventory-lines';
import type {
  InventoryAdjustment,
  InventoryLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import { useDialogCardLayout } from '@/hooks/use-card-view';
import type { QuantityUnit } from '@/lib/quantity';
import { randomId } from '@/lib/random-id';
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
  reasons: readonly Pick<Reason, 'id' | 'name' | 'reasonType'>[];
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
  const { measure, cards } = useDialogCardLayout('table');
  const [defaultValues] = useState(() => ({
    adjustments: [...line.stockAdjustments].reverse().map((item) => ({
      key: randomId(),
      reason: item.reason,
      quantity: quantityValue(String(item.quantity), line.orderable.netContent),
    })),
  }));
  const form = useAppForm({
    defaultValues,
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
        { key: randomId(), reason, quantity: value.quantity },
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
  const removeLabel = (item: (typeof adjustments)[number]) =>
    t('stock-events.field-of', {
      field: t('stock-events.remove'),
      row: `${product} ${inventoryLotCode(line) ?? t('stock-events.no-lot-defined')} ${item.reason.name ?? item.reason.id}`,
    });
  const remove = (index: number) =>
    form.setFieldValue('adjustments', (current) => current.filter((_, i) => i !== index));
  const addButton = (
    <Button type="button" variant="secondary" onClick={() => void addForm.handleSubmit()}>
      <PlusIcon />
      {t('stock-events.add')}
    </Button>
  );
  const apply = () => {
    onUpdate(values());
    setConfirm(false);
  };
  return (
    <FormDialog
      open={open}
      size="table"
      onOpenChangeComplete={onOpenChangeComplete}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4" ref={measure}>
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
              <div className="shrink-0">
                <fieldset
                  className={cards ? 'flex flex-col gap-3' : 'flex items-start gap-3'}
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
                  <div className={cards ? undefined : 'min-w-0 flex-1'}>
                    <addForm.AppField name="reasonId">
                      {(field) => (
                        <field.SelectField
                          label={t('stock-events.reason')}
                          placeholder={t('stock-event-reverse.select-option')}
                          required
                          items={reasons.map((reason) => ({
                            value: reason.id,
                            label: reason.name,
                          }))}
                        />
                      )}
                    </addForm.AppField>
                  </div>
                  <div className={cards ? undefined : 'min-w-0 flex-1'}>
                    <addForm.AppField name="quantity">
                      {(field) => (
                        <field.QuantityField
                          label={t('stock-events.quantity')}
                          unit={unit}
                          netContent={line.orderable.netContent}
                          dosesLabel={t('quantity-unit.doses')}
                          packsLabel={t('quantity-unit.packs')}
                          notation="plus"
                          required
                        />
                      )}
                    </addForm.AppField>
                  </div>
                  {cards ? (
                    addButton
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span aria-hidden className="invisible text-sm leading-snug">
                        &nbsp;
                      </span>
                      {addButton}
                    </div>
                  )}
                </fieldset>
              </div>
              {cards ? (
                <div className="py-1">
                  <div className="overflow-hidden rounded-xl border bg-card">
                    {adjustments.length ? (
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
                              <CardActions
                                label={t('card-actions.actions-for', {
                                  name: `${product} ${inventoryLotCode(line) ?? t('stock-events.no-lot-defined')} ${item.reason.name ?? item.reason.id}`,
                                })}
                                actions={[
                                  {
                                    id: 'remove',
                                    icon: <Trash2Icon />,
                                    label: t('stock-events.remove'),
                                    name: removeLabel(item),
                                    destructive: true,
                                    onSelect: () => remove(index),
                                  },
                                ]}
                              />
                            </div>
                          </CardControlRow>
                        ))}
                      </CardRows>
                    ) : (
                      <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                        {t('physical-inventory.no-adjustments')}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <Table density="compact">
                    <TableHeader surface="muted">
                      <TableRow>
                        <TableHead>
                          <DataTableHeaderLabel>{t('stock-events.reason')}</DataTableHeaderLabel>
                        </TableHead>
                        <TableHead>
                          <DataTableHeaderLabel>{t('stock-events.quantity')}</DataTableHeaderLabel>
                        </TableHead>
                        <TableHead>
                          <DataTableHeaderLabel>{t('stock-events.actions')}</DataTableHeaderLabel>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustments.length ? (
                        adjustments.map((item, index) => (
                          <TableRow key={item.key}>
                            <TableCell>
                              <bdi className="whitespace-normal">
                                {item.reason.name ?? item.reason.id}
                              </bdi>
                            </TableCell>
                            <TableCell>
                              <form.AppField name={`adjustments[${index}].quantity`}>
                                {(field) => (
                                  <field.QuantityField
                                    label={item.reason.name ?? item.reason.id}
                                    layout="inline"
                                    hideErrors
                                    unit={unit}
                                    netContent={line.orderable.netContent}
                                    dosesLabel={t('quantity-unit.doses')}
                                    packsLabel={t('quantity-unit.packs')}
                                    notation="plus"
                                    required
                                  />
                                )}
                              </form.AppField>
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="destructive-ghost"
                                size="icon-sm"
                                aria-label={removeLabel(item)}
                                onClick={() => remove(index)}
                              >
                                <Trash2Icon />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3}>
                            <div className="py-4 text-center text-muted-foreground whitespace-normal">
                              {t('physical-inventory.no-adjustments')}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              {cards ? (
                <div className="shrink-0 overflow-hidden rounded-xl border bg-card">
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
              ) : (
                <div className="flex shrink-0 flex-wrap justify-between gap-2 text-sm">
                  <span>
                    <strong>{t('physical-inventory.unaccounted')}</strong>{' '}
                    <bdi className={difference ? 'text-destructive' : undefined} dir="ltr">
                      {display(difference)}
                    </bdi>
                  </span>
                  <span>
                    <strong>{t('physical-inventory.total')}</strong>{' '}
                    <bdi dir="ltr">{display(adjustmentTotal(values()))}</bdi>
                  </span>
                </div>
              )}
            </div>
          </FormDialogBody>
          <FormDialogFooter>
            <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
            <FormDialogSubmit>{t('physical-inventory.update')}</FormDialogSubmit>
          </FormDialogFooter>
        </FormDialogForm>
      </div>
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
