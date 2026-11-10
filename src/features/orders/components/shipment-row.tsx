import { useStore } from '@tanstack/react-form';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateValue } from '@/components/form/date-value';
import { type ShipmentForm, shipmentFieldKey } from '@/features/orders/lib/shipment-form';
import {
  type ShipmentGroup,
  type ShipmentLine,
  validateShipmentFill,
} from '@/features/orders/lib/shipment-lines';
import { groupQuantities, lineQuantities } from '@/features/orders/lib/shipment-quantities';
import type { Order } from '@/features/orders/lib/types';
import type { QuantityUnit } from '@/lib/quantity';
import { toLatinDigits } from '@/lib/whole-number';

export const SHIPMENT_COLUMNS = [
  'product-code',
  'product',
  'lot-code',
  'vvm',
  'expiry',
  'ordered',
  'fill',
  'available',
  'remaining',
] as const;
export type ShipmentGridProps = {
  form: ShipmentForm;
  order: Order;
  lines: ShipmentLine[];
  unit: QuantityUnit;
  canEdit: boolean;
  disabled: boolean;
  attempted: boolean;
};
export type ShipmentDisplayRow = {
  key: string;
  line?: ShipmentLine;
  group?: ShipmentGroup;
  ordered?: number | null;
  hideProduct?: boolean;
  noStock?: boolean;
};
export function shipmentDisplayRows(groups: ShipmentGroup[]): ShipmentDisplayRow[] {
  return groups.flatMap((group) => {
    if (group.kind === 'single')
      return [{ key: group.product.id, line: group.lines[0], ordered: group.orderedQuantity }];
    const rows: ShipmentDisplayRow[] = [
      { key: group.product.id, group, ordered: group.orderedQuantity },
    ];
    if (group.noStock) rows.push({ key: `${group.product.id}-empty`, noStock: true });
    for (const child of group.children) {
      if (child.kind === 'subgroup') {
        rows.push({ key: `${group.product.id}-${child.product.id}`, group: child });
        if (child.noStock)
          rows.push({ key: `${group.product.id}-${child.product.id}-empty`, noStock: true });
      }
      for (const line of child.lines)
        rows.push({
          key: `${group.product.id}-${line.key}`,
          line,
          hideProduct: child.kind === 'subgroup',
        });
    }
    return rows;
  });
}
function numericFill(text: string) {
  const value = Number(toLatinDigits(text));
  return Number.isFinite(value) ? value : 0;
}
export function useShipmentRow(props: ShipmentGridProps, row: ShipmentDisplayRow) {
  const { t, i18n } = useTranslation();
  const selected = useStore(props.form.store, (state) =>
    JSON.stringify(
      (row.group?.lines ?? (row.line ? [row.line] : [])).map(
        (line) => state.values.lines[shipmentFieldKey(line.key)]?.fill ?? '',
      ),
    ),
  );
  const selectedLines = row.group?.lines ?? (row.line ? [row.line] : []);
  const values = Object.fromEntries(
    selectedLines.map((line, index) => [
      shipmentFieldKey(line.key),
      { fill: (JSON.parse(selected) as string[])[index] },
    ]),
  );
  const line = row.line;
  const fill = line ? (values[shipmentFieldKey(line.key)]?.fill ?? '') : '';
  const quantity = row.group
    ? groupQuantities(
        row.ordered ?? 0,
        row.group.lines.map((item) => ({
          stockOnHand: item.stockOnHand,
          fill: numericFill(values[shipmentFieldKey(item.key)]?.fill ?? ''),
          netContent: item.product.netContent,
        })),
        row.group.product.netContent,
        props.unit,
      )
    : lineQuantities(
        row.ordered ?? 0,
        line?.stockOnHand ?? 0,
        numericFill(fill),
        line?.product.netContent,
        props.unit,
      );
  const product = line?.product ?? row.group?.product;
  const display: Record<(typeof SHIPMENT_COLUMNS)[number], ReactNode> = {
    'product-code': row.hideProduct ? null : product?.productCode,
    product: row.hideProduct ? null : product?.fullProductName,
    'lot-code': line ? (line.lot?.lotCode ?? t('orders.shipment.no-lot')) : null,
    vvm: line?.vvmStatus ? t(line.vvmStatus === 'STAGE_2' ? 'vvm.stage-2' : 'vvm.stage-1') : null,
    expiry: formatDateValue(line?.lot?.expirationDate ?? '', i18n.language),
    ordered: row.ordered == null ? null : quantity.ordered,
    fill: quantity.fill,
    available: quantity.available,
    remaining: quantity.remaining,
  };
  const touched = useStore(props.form.store, (state) =>
    line
      ? (state.fieldMeta[`lines.${shipmentFieldKey(line.key)}.fill`]?.isBlurred ?? false)
      : false,
  );
  return { display, fill, touched, error: line ? validateShipmentFill(line, fill) : null };
}
export function ShipmentFill({
  form,
  line,
  disabled,
  attempted,
}: Pick<ShipmentGridProps, 'form' | 'disabled' | 'attempted'> & { line: ShipmentLine }) {
  const { t } = useTranslation();
  const name = `lines.${shipmentFieldKey(line.key)}.fill` as const;
  const touched = useStore(form.store, (state) => state.fieldMeta[name]?.isBlurred ?? false);
  const show = touched || attempted;
  const value = useStore(
    form.store,
    (state) => state.values.lines[shipmentFieldKey(line.key)]?.fill ?? '',
  );
  const issue = validateShipmentFill(line, value);
  useEffect(() => {
    if (show)
      form.setFieldMeta(name, (meta) => ({
        ...meta,
        errorMap: { ...meta.errorMap, onBlur: undefined, onChange: issue ?? undefined },
      }));
  }, [show, issue, form, name]);
  return (
    <div className="min-w-24">
      <form.AppField
        name={name}
        validators={{
          onChange: ({ value }) => {
            const error = validateShipmentFill(line, value);
            return show && error ? error : undefined;
          },
          onBlur: ({ value }) => {
            const error = validateShipmentFill(line, value);
            return error ?? undefined;
          },
        }}
      >
        {(field) => (
          <field.NumberField
            label={t('orders.shipment.fill-label', {
              product: line.product.fullProductName ?? line.product.id,
              lot: line.lot?.lotCode ?? t('orders.shipment.no-lot'),
            })}
            layout="inline"
            hideErrors
            required
            disabled={disabled}
            controlSize="sm"
          />
        )}
      </form.AppField>
    </div>
  );
}
