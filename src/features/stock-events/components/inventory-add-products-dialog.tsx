import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { formatDateValue, toDateValue } from '@/components/form/date-value';
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
import { LoadError } from '@/components/load-error';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { inventoryCountSchema } from '@/features/stock-events/lib/physical-inventory-form';
import {
  addedInventoryLine,
  availableInventoryLots,
  inventoryLotSchema,
} from '@/features/stock-events/lib/physical-inventory-products';
import type {
  InventoryLine,
  InventoryStockLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import { orEmpty } from '@/lib/empty-value';
import type { QuantityUnit } from '@/lib/quantity';

type Props = {
  error?: unknown;
  onRetry?: () => void;
  eligible: readonly InventoryStockLine[] | undefined;
  listed: readonly InventoryLine[];
  canManageLots: boolean;
  unit: QuantityUnit;
  onClose: () => void;
  onAdd: (lines: InventoryLine[]) => void;
};
const NEW = 'new';

export function InventoryAddProductsDialog(props: Props) {
  const { t } = useTranslation();
  return (
    <FormDialog
      open
      size="xl"
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      {props.eligible ? (
        <AddProductsForm {...props} eligible={props.eligible} />
      ) : (
        <>
          <FormDialogHeader>
            <FormDialogTitle>{t('physical-inventory.add-products-title')}</FormDialogTitle>
            <FormDialogDescription>
              {t('physical-inventory.products-loading')}
            </FormDialogDescription>
          </FormDialogHeader>
          {props.error && (
            <FormDialogBody>
              <LoadError
                error={props.error}
                reset={() => props.onRetry?.()}
                title={t('physical-inventory.load-error-title')}
                description={t('physical-inventory.load-error-description')}
              />
            </FormDialogBody>
          )}
          <FormDialogFooter>
            <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
          </FormDialogFooter>
        </>
      )}
    </FormDialog>
  );
}

function AddProductsForm({
  eligible,
  listed,
  canManageLots,
  unit,
  onAdd,
}: Props & { eligible: readonly InventoryStockLine[] }) {
  const { t, i18n } = useTranslation();
  const today = toDateValue(new Date());
  const itemsForm = useAppForm({
    defaultValues: { items: [] as InventoryLine[] },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: z
        .object({ items: z.array(z.custom<InventoryLine>()).min(1) })
        .superRefine((value, ctx) => {
          value.items.forEach((line, index) => {
            const result = inventoryCountSchema.safeParse(line.quantity.doses);
            for (const issue of result.error?.issues ?? [])
              ctx.addIssue({
                code: 'custom',
                path: ['items', index, 'quantity', 'doses'],
                message: issue.message,
              });
          });
        }),
    },
    onSubmit: ({ value }) => onAdd(value.items),
  });
  const items = useStore(itemsForm.store, (state) => state.values.items);
  const selection = useAppForm({
    defaultValues: { productId: '', lotId: '', lotCode: '', expirationDate: '' },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: z
        .object({
          productId: z.string().min(1, 'stock-events.required'),
          lotId: z.string().min(1, 'stock-events.required'),
          lotCode: z.string(),
          expirationDate: z.string(),
        })
        .superRefine((value, ctx) => {
          if (value.lotId !== NEW) return;
          const result = inventoryLotSchema(
            value.productId,
            [...eligible, ...listed, ...items],
            today,
          ).safeParse(value);
          for (const issue of result.error?.issues ?? [])
            ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
        }),
    },
    onSubmit: ({ value }) => {
      const candidate = eligible.find(
        (line) =>
          line.orderable.id === value.productId &&
          (value.lotId === NEW || (line.lot?.id ?? 'none') === value.lotId),
      );
      if (!candidate) return;
      if (value.lotId === NEW && !canManageLots) return;
      const newLot =
        value.lotId === NEW
          ? {
              clientId: crypto.randomUUID(),
              lotCode: value.lotCode.trim(),
              expirationDate: value.expirationDate || null,
              tradeItemId: candidate.orderable.identifiers?.tradeItem ?? '',
            }
          : undefined;
      const line = addedInventoryLine(
        candidate,
        quantityValue('', candidate.orderable.netContent),
        newLot,
      );
      if ([...listed, ...items].some((item) => item.key === line.key)) return;
      itemsForm.setFieldValue('items', (current) => [...current, line]);
      selection.reset({ ...value, lotId: '', lotCode: '', expirationDate: '' });
    },
  });
  const picked = useStore(selection.store, (state) => state.values);
  const products = useMemo(
    () =>
      [...new Map(eligible.map((line) => [line.orderable.id, line.orderable])).values()].sort(
        (a, b) => a.productCode.localeCompare(b.productCode),
      ),
    [eligible],
  );
  const lots = availableInventoryLots(eligible, [...listed, ...items], picked.productId);
  const newAllowed = canManageLots;
  const lotItems = [
    ...(newAllowed ? [{ value: NEW, label: t('physical-inventory.add-new-lot') }] : []),
    ...lots.map((line) => ({
      value: line.lot?.id ?? 'none',
      label: line.lot?.lotCode ?? t('stock-events.no-lot-defined'),
    })),
  ];
  return (
    <FormDialogForm onSubmit={() => void itemsForm.handleSubmit()}>
      <FormDialogHeader>
        <FormDialogTitle>{t('physical-inventory.add-products-title')}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <div className="flex flex-col gap-4">
          <FieldGroup>
            <selection.AppField
              name="productId"
              listeners={{
                onChange: () => {
                  selection.setFieldValue('lotId', '');
                  selection.setFieldValue('lotCode', '');
                  selection.setFieldValue('expirationDate', '');
                },
              }}
            >
              {(field) => (
                <field.ComboboxField
                  label={t('stock-events.product')}
                  clearLabel={t('stock-events.clear')}
                  emptyMessage={t('stock-events.no-matches-title')}
                  required
                  items={products.map((product) => ({
                    value: product.id,
                    label: product.fullProductName || product.productCode,
                  }))}
                />
              )}
            </selection.AppField>
            <selection.AppField name="lotId">
              {(field) => (
                <field.SelectField
                  label={t('stock-events.lot-code')}
                  required
                  disabled={!picked.productId}
                  items={lotItems}
                />
              )}
            </selection.AppField>
            {picked.lotId === NEW && newAllowed && (
              <>
                <selection.AppField name="lotCode">
                  {(field) => (
                    <field.TextField
                      label={t('physical-inventory.new-lot-code')}
                      required
                      dir="auto"
                    />
                  )}
                </selection.AppField>
                <selection.AppField name="expirationDate">
                  {(field) => (
                    <field.DateField
                      label={t('stock-events.expiry-date')}
                      placeholder={t('stock-events.expiry-date')}
                      earliest={today}
                      clearLabel={t('stock-events.clear')}
                    />
                  )}
                </selection.AppField>
              </>
            )}
          </FieldGroup>
          <Button type="button" onClick={() => void selection.handleSubmit()}>
            {t('stock-events.add')}
          </Button>
          <Table layout="auto" density="compact">
            <TableHeader>
              <TableRow>
                {[
                  'stock-events.product-code',
                  'stock-events.product',
                  'stock-events.pack-size',
                  'stock-events.lot-code',
                  'stock-events.expiry-date',
                  'physical-inventory.current-stock',
                  'stock-events.actions',
                ].map((key) => (
                  <TableHead key={key}>{t(key as 'stock-events.product')}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((line, index) => (
                <TableRow key={line.key}>
                  <TableCell>
                    <bdi>{line.orderable.productCode}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{line.orderable.fullProductName || line.orderable.productCode}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{orEmpty(line.orderable.netContent)}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>
                      {line.lot?.lotCode ??
                        line.newLot?.lotCode ??
                        t('stock-events.no-lot-defined')}
                    </bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>
                      {orEmpty(
                        (line.lot?.expirationDate ?? line.newLot?.expirationDate)
                          ? formatDateValue(
                              line.lot?.expirationDate ?? line.newLot?.expirationDate ?? '',
                              i18n.language,
                            )
                          : null,
                      )}
                    </bdi>
                  </TableCell>
                  <TableCell>
                    <div className={unit === 'PACKS' ? 'w-28' : 'w-20'}>
                      <itemsForm.AppField name={`items[${index}].quantity`}>
                        {(field) => (
                          <field.QuantityField
                            label={t('stock-events.field-of', {
                              field: t('physical-inventory.current-stock'),
                              row: `${line.orderable.fullProductName || line.orderable.productCode} ${line.lot?.lotCode ?? line.newLot?.lotCode ?? t('stock-events.no-lot-defined')}`,
                            })}
                            layout="inline"
                            required
                            netContent={line.orderable.netContent}
                            unit={unit}
                            dosesLabel={t('quantity-unit.doses')}
                            packsLabel={t('quantity-unit.packs')}
                          />
                        )}
                      </itemsForm.AppField>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        itemsForm.setFieldValue('items', (current) =>
                          current.filter((item) => item.key !== line.key),
                        )
                      }
                    >
                      {t('stock-events.remove')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled={!items.length}>
          {t('physical-inventory.add-items', { count: items.length })}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}
