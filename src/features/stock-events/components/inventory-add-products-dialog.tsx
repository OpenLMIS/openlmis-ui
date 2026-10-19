import { revalidateLogic, useStore } from '@tanstack/react-form';
import { Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { CardBand, CardControlRow, CardList, CardListItem, CardRows } from '@/components/card-list';
import { DataTableHeaderLabel } from '@/components/data-table/data-table';
import { toDateValue } from '@/components/form/date-value';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { productName } from '@/features/reference-data/lib/product-name';
import { InventoryLotFields } from '@/features/stock-events/components/inventory-lot-fields';
import { ProductName } from '@/features/stock-events/components/product-name';
import { inventoryCountSchema } from '@/features/stock-events/lib/physical-inventory-form';
import { inventoryFormats } from '@/features/stock-events/lib/physical-inventory-format';
import {
  inventoryExpiry,
  inventoryLineKey,
  inventoryLotCode,
} from '@/features/stock-events/lib/physical-inventory-lines';
import {
  addedInventoryLine,
  availableInventoryLots,
  inventoryLotSchema,
} from '@/features/stock-events/lib/physical-inventory-products';
import type {
  InventoryLine,
  InventoryStockLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import { useCardLayout } from '@/hooks/use-card-view';
import { orEmpty, tableValue } from '@/lib/empty-value';
import type { QuantityUnit } from '@/lib/quantity';
import { toLatinDigits } from '@/lib/whole-number';

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
      size="2xl"
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
  const { measure, cards } = useCardLayout<HTMLDivElement>();
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
  const available = useMemo(() => {
    const keys = new Set(listed.map((line) => line.key));
    return eligible.filter((line) => !keys.has(inventoryLineKey(line.orderable.id, line.lot?.id)));
  }, [eligible, listed]);
  const products = useMemo(
    () => [
      ...new Map(
        [...available, ...eligible].map((line) => [line.orderable.id, line.orderable]),
      ).values(),
    ],
    [eligible, available],
  );
  const lotLabel = (line: InventoryLine) =>
    inventoryLotCode(line) ??
    t(
      available.some((item) => item.orderable.id === line.orderable.id && item.lot)
        ? 'stock-events.no-lot-defined'
        : 'stock-events.product-has-no-lots',
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
  const quantityField = (line: InventoryLine, index: number) => (
    <fieldset
      className={cards ? 'min-w-0' : unit === 'PACKS' ? 'w-28' : 'w-20'}
      onChangeCapture={(event) => {
        if (event.target instanceof HTMLInputElement)
          event.target.value = toLatinDigits(event.target.value).replace(/[^0-9]/g, '');
      }}
    >
      <itemsForm.AppField name={`items[${index}].quantity`}>
        {(field) => (
          <field.QuantityField
            label={t('stock-events.field-of', {
              field: t('physical-inventory.current-stock'),
              row: `${productName(line.orderable)} ${lotLabel(line)}`,
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
    </fieldset>
  );
  const removeButton = (line: InventoryLine) => (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="destructive-ghost"
            size="icon-sm"
            aria-label={t('stock-events.field-of', {
              field: t('stock-events.remove'),
              row: `${productName(line.orderable)} ${lotLabel(line)}`,
            })}
            onClick={() =>
              itemsForm.setFieldValue('items', (current) =>
                current.filter((item) => item.key !== line.key),
              )
            }
          />
        }
      >
        <Trash2Icon />
      </TooltipTrigger>
      <TooltipContent>{t('stock-events.remove')}</TooltipContent>
    </Tooltip>
  );
  return (
    <FormDialogForm onSubmit={() => void itemsForm.handleSubmit()}>
      <FormDialogHeader>
        <FormDialogTitle>{t('physical-inventory.add-products-title')}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <div className="flex min-w-0 flex-col gap-4">
          <fieldset
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                event.target instanceof HTMLInputElement &&
                !event.defaultPrevented
              ) {
                event.preventDefault();
                event.stopPropagation();
                void selection.handleSubmit();
              }
            }}
          >
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
                      label: product.fullProductName ?? '',
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
                <InventoryLotFields form={selection} today={today} newLot />
              )}
            </FieldGroup>
          </fieldset>
          <Button type="button" onClick={() => void selection.handleSubmit()}>
            {t('stock-events.add')}
          </Button>
          <div ref={measure} className="min-w-0">
            {cards ? (
              items.length > 0 && (
                <CardList>
                  {items.map((line, index) => (
                    <CardListItem key={line.key} surface="flat">
                      <CardBand>
                        <span className="min-w-0 flex-1 wrap-anywhere">
                          <bdi>
                            {line.orderable.fullProductName} ({line.orderable.productCode})
                          </bdi>
                        </span>
                        {removeButton(line)}
                      </CardBand>
                      <CardRows>
                        <SettingsItem label={t('stock-events.pack-size')}>
                          <bdi>{orEmpty(line.orderable.netContent)}</bdi>
                        </SettingsItem>
                        <SettingsItem label={t('stock-events.lot-code')}>
                          <bdi>{lotLabel(line)}</bdi>
                        </SettingsItem>
                        <SettingsItem label={t('stock-events.expiry-date')}>
                          <bdi>
                            {orEmpty(
                              inventoryExpiry(line)
                                ? inventoryFormats(i18n.language).date(inventoryExpiry(line) ?? '')
                                : null,
                            )}
                          </bdi>
                        </SettingsItem>
                        <CardControlRow label={t('physical-inventory.current-stock')}>
                          {quantityField(line, index)}
                        </CardControlRow>
                      </CardRows>
                    </CardListItem>
                  ))}
                </CardList>
              )
            ) : (
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
                      <TableHead key={key}>
                        <DataTableHeaderLabel>
                          {t(key as 'stock-events.product')}
                        </DataTableHeaderLabel>
                      </TableHead>
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
                        <ProductName label={line.orderable.fullProductName ?? ''} width="wide" />
                      </TableCell>
                      <TableCell>
                        <bdi>{tableValue(line.orderable.netContent)}</bdi>
                      </TableCell>
                      <TableCell>
                        <bdi>{lotLabel(line)}</bdi>
                      </TableCell>
                      <TableCell>
                        <bdi>
                          {tableValue(
                            inventoryExpiry(line)
                              ? inventoryFormats(i18n.language).date(inventoryExpiry(line) ?? '')
                              : null,
                          )}
                        </bdi>
                      </TableCell>
                      <TableCell>{quantityField(line, index)}</TableCell>
                      <TableCell>{removeButton(line)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
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
