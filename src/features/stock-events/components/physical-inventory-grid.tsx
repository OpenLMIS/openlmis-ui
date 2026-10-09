import { useStore } from '@tanstack/react-form';
import type { ColumnVisibilityState } from '@tanstack/react-table';
import { EllipsisIcon } from 'lucide-react';
import { Fragment, memo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard } from '@/components/data-table/data-table';
import { useFieldContext } from '@/components/form/form-context';
import type { QuantityValue } from '@/components/form/quantity-value';
import { updateQuantityValue } from '@/components/form/quantity-value';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { productName } from '@/features/reference-data/lib/product-name';
import type { PhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import {
  inventoryCountSchema,
  inventoryLineError,
  unaccounted,
} from '@/features/stock-events/lib/physical-inventory-form';
import { inventoryFormats } from '@/features/stock-events/lib/physical-inventory-format';
import {
  inventoryExpiry,
  inventoryLotCode,
} from '@/features/stock-events/lib/physical-inventory-lines';
import { canDeactivateInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';
import type {
  InventoryCategoryBand,
  InventoryLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import { orEmpty } from '@/lib/empty-value';
import type { QuantityUnit } from '@/lib/quantity';
import { cn } from '@/lib/utils';
import { toLatinDigits, toOptionalWholeNumber } from '@/lib/whole-number';

const COLUMNS = [
  ['productCode', 'stock-events.product-code'],
  ['product', 'stock-events.product'],
  ['packSize', 'stock-events.pack-size'],
  ['lot', 'stock-events.lot-code'],
  ['expiry', 'stock-events.expiry-date'],
  ['stock', 'stock-events.stock-on-hand'],
  ['count', 'physical-inventory.current-stock'],
  ['vvm', 'stock-events.vvm-status'],
  ['reasons', 'physical-inventory.reasons'],
  ['unaccounted', 'physical-inventory.unaccounted'],
  ['actions', 'stock-events.actions'],
] as const;
type ColumnId = (typeof COLUMNS)[number][0];
export const INVENTORY_HIDEABLE_COLUMNS = [
  { id: 'productCode', labelKey: 'stock-events.product-code', hideBelow: 1600 },
  { id: 'packSize', labelKey: 'stock-events.pack-size', hideBelow: 1480 },
  { id: 'expiry', labelKey: 'stock-events.expiry-date', hideBelow: 1360 },
  { id: 'stock', labelKey: 'stock-events.stock-on-hand', hideBelow: 1200 },
] as const;
const visibleColumns = (visibility: ColumnVisibilityState, showVvm: boolean) =>
  COLUMNS.filter(
    ([id]) =>
      (!INVENTORY_HIDEABLE_COLUMNS.some((column) => column.id === id) ||
        visibility[id] !== false) &&
      (id !== 'vvm' || showVvm),
  );

type InventoryGridEditor = {
  form: PhysicalInventoryForm;
  unit: QuantityUnit;
  online: boolean;
  validationAttempted: boolean;
  pending: boolean;
  onReasons: (line: InventoryLine) => void;
  onEditLot: (line: InventoryLine) => void;
  onRemove: (line: InventoryLine) => void;
  onDeactivate: (line: InventoryLine) => void;
};
type Props = {
  editor: InventoryGridEditor;
  bands: readonly InventoryCategoryBand[];
  visibility: ColumnVisibilityState;
  showVvm: boolean;
  showActions: boolean;
};
const COLUMN_WIDTHS: Record<ColumnId, string> = {
  productCode: 'w-32',
  product: 'w-56',
  packSize: 'w-24',
  lot: 'w-40',
  expiry: 'w-36',
  stock: 'w-40',
  count: 'w-48',
  vvm: 'w-32',
  reasons: 'w-40',
  unaccounted: 'w-48',
  actions: 'w-12',
};
export function PhysicalInventoryGrid({ bands, visibility, showVvm, showActions, editor }: Props) {
  const { t } = useTranslation();
  const columns = visibleColumns(visibility, showVvm).filter(
    ([id]) => id !== 'actions' || showActions,
  );
  return (
    <DataTableCard>
      <Table
        density="comfortable"
        layout="auto"
        tabIndex={-1}
        aria-label={t('physical-inventory.editor-crumb')}
      >
        <colgroup>
          {columns.map(([id]) => (
            <col key={id} className={COLUMN_WIDTHS[id]} />
          ))}
        </colgroup>
        <TableHeader surface="muted">
          <TableRow>
            {columns.map(([id, key]) => (
              <TableHead key={id}>
                <span
                  className={cn(
                    'block whitespace-nowrap text-2xs font-medium tracking-wide',
                    COLUMN_WIDTHS[id],
                  )}
                >
                  {t(key)}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {bands.map((band) => (
            <Fragment key={band.category}>
              <TableRow surface="muted">
                <TableCell colSpan={columns.length}>
                  <bdi>{band.category}</bdi>
                </TableCell>
              </TableRow>
              {band.groups.map((group) => (
                <Fragment key={group.orderable.id}>
                  {group.lines.length > 1 ? (
                    <TableRow surface="muted">
                      {columns.map(([id]) => (
                        <TableCell key={id}>
                          <InventoryCell
                            id={id}
                            editor={editor}
                            line={group.lines[0]}
                            summary={group.lines}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ) : null}
                  {group.lines.map((line) => (
                    <InventoryRow
                      key={line.key}
                      lineKey={line.key}
                      editor={editor}
                      columns={columns}
                      hideProduct={group.lines.length > 1}
                    />
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </DataTableCard>
  );
}

const InventoryRow = memo(
  function InventoryRow({
    lineKey,
    editor,
    columns,
    hideProduct,
  }: {
    lineKey: string;
    editor: InventoryGridEditor;
    columns: readonly (typeof COLUMNS)[number][];
    hideProduct: boolean;
  }) {
    const line = useStore(editor.form.store, (state) => state.values.lines[lineKey]);
    if (!line) return null;
    return (
      <TableRow>
        {columns.map(([id]) => (
          <TableCell key={id}>
            <InventoryCell id={id} editor={editor} line={line} hideProduct={hideProduct} />
          </TableCell>
        ))}
      </TableRow>
    );
  },
  (previous, next) =>
    previous.lineKey === next.lineKey &&
    previous.editor === next.editor &&
    previous.hideProduct === next.hideProduct &&
    previous.columns.map(([id]) => id).join() === next.columns.map(([id]) => id).join(),
);

function InventoryCell({
  id,
  line,
  summary,
  hideProduct,
  editor,
}: {
  editor: InventoryGridEditor;
  id: ColumnId;
  line: InventoryLine;
  summary?: readonly InventoryLine[];
  hideProduct?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const formats = inventoryFormats(i18n.language);
  const format = formats.number;
  const errorId = useId();
  const countResult =
    id === 'count' && !summary ? inventoryCountSchema.safeParse(line.quantity.doses) : null;
  const error = !countResult
    ? null
    : editor.validationAttempted
      ? inventoryLineError(line)
      : line.quantity.doses.trim() && !countResult.success
        ? countResult.error.issues[0].message
        : null;
  const row = `${productName(line.orderable)} ${inventoryLotCode(line) ?? t('stock-events.no-lot-defined')}`;
  const label = (field: string) => t('stock-events.field-of', { field, row });
  const number = (value: number | null | undefined) => (
    <span className="tabular-nums">
      <bdi>{orEmpty(value == null ? null : format(value))}</bdi>
    </span>
  );
  const total = (get: (item: InventoryLine) => number | null) => {
    const values = (summary ?? [line]).map(get);
    return values.every((value) => value === null)
      ? null
      : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  };
  switch (id) {
    case 'productCode':
      return hideProduct ? null : <bdi>{line.orderable.productCode}</bdi>;
    case 'product':
      return hideProduct ? null : (
        <span className="block min-w-56 max-w-64 whitespace-normal break-normal font-medium">
          <bdi>
            {productName(line.orderable)}
            {line.orderable.dispensable?.displayUnit
              ? ` - ${line.orderable.dispensable.displayUnit}`
              : ''}
          </bdi>
        </span>
      );
    case 'packSize':
      return number(line.orderable.netContent);
    case 'lot':
      if (!summary && line.newLot)
        return (
          <Button
            variant="link"
            type="button"
            aria-label={label(t('physical-inventory.edit-lot'))}
            onClick={() => editor.onEditLot(line)}
          >
            <span className="whitespace-nowrap">{line.newLot.lotCode}</span>
          </Button>
        );
      return summary ? null : (
        <span className="whitespace-nowrap">
          <bdi>{inventoryLotCode(line) ?? t('stock-events.no-lot-defined')}</bdi>
        </span>
      );
    case 'expiry':
      return summary ? null : (
        <bdi>
          {orEmpty(inventoryExpiry(line) ? formats.date(inventoryExpiry(line) ?? '') : null)}
        </bdi>
      );
    case 'stock':
      return (
        <bdi dir="ltr">
          {orEmpty(
            formats.quantity(
              total((item) => item.stockOnHand),
              line.orderable.netContent,
              editor.unit,
            ),
          )}
        </bdi>
      );
    case 'count':
      if (!summary)
        return (
          <InventoryCount
            editor={editor}
            line={line}
            label={label(t('physical-inventory.current-stock'))}
            error={error || null}
            errorId={errorId}
          />
        );
      return (
        <bdi dir="ltr">
          {orEmpty(
            formats.quantity(
              total((item) => toOptionalWholeNumber(item.quantity.doses)),
              line.orderable.netContent,
              editor.unit,
            ),
          )}
        </bdi>
      );
    case 'unaccounted':
      return summary ? null : (
        <div>
          <bdi dir="ltr">
            {orEmpty(formats.quantity(unaccounted(line), line.orderable.netContent, editor.unit))}
          </bdi>
        </div>
      );
    case 'reasons':
      if (!summary)
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={label(t('physical-inventory.reasons'))}
            disabled={editor.pending || !line.quantity.doses.trim()}
            onClick={() => editor.onReasons(line)}
          >
            <span className="whitespace-nowrap">
              {line.stockAdjustments.length === 0
                ? t('physical-inventory.add-reasons')
                : line.stockAdjustments.length === 1
                  ? (line.stockAdjustments[0].reason.name ?? line.stockAdjustments[0].reason.id)
                  : t('physical-inventory.reason-count', { count: line.stockAdjustments.length })}
            </span>
          </Button>
        );
      return null;
    case 'actions':
      if (summary || (!line.justAdded && !canDeactivateInventoryLine(line, true))) return null;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={label(t('stock-events.actions'))}
                disabled={editor.pending}
              />
            }
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" width="auto">
            <DropdownMenuGroup>
              {line.justAdded ? (
                <DropdownMenuItem variant="destructive" onClick={() => editor.onRemove(line)}>
                  {t('physical-inventory.delete-row')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={!editor.online}
                  onClick={() => editor.onDeactivate(line)}
                >
                  {t('physical-inventory.deactivate')}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    case 'vvm':
      if (!summary && line.orderable.extraData?.useVVM === 'true')
        return (
          <div className="w-32">
            <editor.form.AppField name={`lines.${line.key}.vvmStatus`}>
              {(field) => (
                <field.SelectField
                  layout="inline"
                  label={label(t('stock-events.vvm-status'))}
                  disabled={editor.pending}
                  items={[
                    { value: '', label: t('stock-events.vvm-none') },
                    { value: 'STAGE_1', label: t('stock-events.stage-1') },
                    { value: 'STAGE_2', label: t('stock-events.stage-2') },
                  ]}
                />
              )}
            </editor.form.AppField>
          </div>
        );
      return null;
  }
}

export function PhysicalInventoryGridSkeleton({
  visibility,
  showVvm = false,
  showActions = false,
}: {
  visibility: ColumnVisibilityState;
  showVvm?: boolean;
  showActions?: boolean;
}) {
  const { t } = useTranslation();
  const columns = visibleColumns(visibility, showVvm).filter(
    ([id]) => id !== 'actions' || showActions,
  );
  return (
    <div aria-busy>
      <DataTableCard>
        <Table density="comfortable" layout="auto">
          <colgroup>
            {columns.map(([id]) => (
              <col key={id} className={COLUMN_WIDTHS[id]} />
            ))}
          </colgroup>
          <TableHeader surface="muted">
            <TableRow>
              {columns.map(([id, key]) => (
                <TableHead key={id}>
                  <span
                    className={cn(
                      'block whitespace-nowrap text-2xs font-medium tracking-wide',
                      COLUMN_WIDTHS[id],
                    )}
                  >
                    {t(key)}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2].map((row) => (
              <TableRow key={row}>
                {columns.map(([id]) => (
                  <TableCell key={id}>
                    <div className={`h-4 ${COLUMN_WIDTHS[id]}`}>
                      <Skeleton fill />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableCard>
    </div>
  );
}

function InventoryQuantityInputs({
  editor,
  line,
  label,
  error,
  errorId,
}: {
  editor: InventoryGridEditor;
  line: InventoryLine;
  label: string;
  error: string | null;
  errorId: string;
}) {
  const field = useFieldContext<QuantityValue>();
  const { t } = useTranslation();
  const parts = editor.unit === 'DOSES' ? (['doses'] as const) : (['packs', 'remainder'] as const);
  return (
    <div data-inventory-key={line.key} className={cn('w-32', editor.unit === 'PACKS' && 'w-56')}>
      <Field data-invalid={Boolean(error)} spacing="tight">
        <FieldLabel>
          <span className="sr-only">{label}</span>
        </FieldLabel>
        <div className="flex gap-1">
          {parts.map((part) => (
            <div key={part} className="min-w-24 flex-1">
              <Input
                aria-label={
                  parts.length === 1
                    ? label
                    : `${label} ${t(part === 'packs' ? 'quantity-unit.packs' : 'quantity-unit.doses')}`
                }
                inputMode="numeric"
                dir="ltr"
                value={field.state.value[part]}
                disabled={editor.pending}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                onBlur={field.handleBlur}
                onChange={(event) =>
                  field.handleChange(
                    updateQuantityValue(
                      field.state.value,
                      part,
                      toLatinDigits(event.target.value).replace(/[^0-9]/g, ''),
                      line.orderable.netContent,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
        {error && (
          <p id={errorId} className="whitespace-normal text-destructive text-xs">
            {t(error as 'stock-events.required')}
          </p>
        )}
      </Field>
    </div>
  );
}

function InventoryCount(props: Parameters<typeof InventoryQuantityInputs>[0]) {
  const { editor, line } = props;
  return (
    <editor.form.AppField name={`lines.${line.key}.quantity`}>
      {() => <InventoryQuantityInputs {...props} />}
    </editor.form.AppField>
  );
}
