import { useStore } from '@tanstack/react-form';
import type { ColumnVisibilityState } from '@tanstack/react-table';
import { EllipsisIcon } from 'lucide-react';
import { Fragment, memo, type ReactNode, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
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
  { id: 'productCode', labelKey: 'stock-events.product-code' },
  { id: 'packSize', labelKey: 'stock-events.pack-size' },
  { id: 'expiry', labelKey: 'stock-events.expiry-date' },
  { id: 'stock', labelKey: 'stock-events.stock-on-hand' },
] as const;
export const INVENTORY_COLUMN_MIN_WIDTHS = {
  productCode: { rem: 7.5, width: 'w-30', content: 'min-w-28' },
  product: { rem: 8, width: 'w-32', content: 'min-w-30' },
  packSize: { rem: 5, width: 'w-20', content: 'min-w-18' },
  lot: { rem: 12, width: 'w-48', content: 'min-w-46' },
  expiry: { rem: 7, width: 'w-28', content: 'min-w-26' },
  stock: { rem: 7.5, width: 'w-30', content: 'min-w-28' },
  count: { rem: 8, width: 'w-32', content: 'min-w-30' },
  vvm: { rem: 8, width: 'w-32', content: 'min-w-30' },
  reasons: { rem: 7, width: 'w-28', content: 'min-w-26' },
  unaccounted: { rem: 11.5, width: 'w-46', content: 'min-w-44' },
  actions: { rem: 4.5, width: 'w-18', content: 'min-w-16' },
} satisfies Record<ColumnId, { rem: number; width: string; content: string }>;

type InventoryColumnLayout = { showVvm: boolean; showActions: boolean; unit?: QuantityUnit };
const columnMinWidth = (id: ColumnId, unit: QuantityUnit = 'DOSES') =>
  id === 'count' && unit === 'PACKS'
    ? { rem: 12, width: 'w-48', content: 'min-w-46' }
    : INVENTORY_COLUMN_MIN_WIDTHS[id];

export function inventoryHideableColumns(
  { showVvm, showActions, unit }: InventoryColumnLayout,
  choices: ColumnVisibilityState = {},
) {
  let required =
    2 +
    COLUMNS.reduce((sum, [id]) => {
      if ((id === 'vvm' && !showVvm) || (id === 'actions' && !showActions)) return sum;
      if (choices[id] === false && INVENTORY_HIDEABLE_COLUMNS.some((column) => column.id === id))
        return sum;
      return sum + columnMinWidth(id, unit).rem * 16;
    }, 0);
  return INVENTORY_HIDEABLE_COLUMNS.map((column) => {
    const hideBelow = required;
    if (choices[column.id] == null) required -= columnMinWidth(column.id, unit).rem * 16;
    return { ...column, hideBelow };
  });
}

function InventoryColumnContent({
  id,
  unit,
  children,
}: {
  id: ColumnId;
  unit?: QuantityUnit;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        columnMinWidth(id, unit).content,
        id === 'product' ? 'whitespace-normal break-normal' : 'whitespace-nowrap',
      )}
    >
      {children}
    </div>
  );
}

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
export function PhysicalInventoryGrid({ bands, visibility, showVvm, showActions, editor }: Props) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => visibleColumns(visibility, showVvm).filter(([id]) => id !== 'actions' || showActions),
    [visibility, showVvm, showActions],
  );
  return (
    <DataTableCard>
      <Table
        density="compact"
        layout="auto"
        tabIndex={-1}
        aria-label={t('physical-inventory.editor-crumb')}
      >
        <colgroup>
          {columns.map(([id]) => (
            <col key={id} className={columnMinWidth(id, editor.unit).width} />
          ))}
        </colgroup>
        <TableHeader surface="muted">
          <TableRow>
            {columns.map(([id, key]) => (
              <TableHead key={id} data-inventory-column={id}>
                <InventoryColumnContent id={id} unit={editor.unit}>
                  <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
                </InventoryColumnContent>
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
                    <InventorySummaryRow editor={editor} lines={group.lines} columns={columns} />
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

const InventorySummaryRow = memo(function InventorySummaryRow({
  editor,
  lines,
  columns,
}: {
  editor: InventoryGridEditor;
  lines: readonly InventoryLine[];
  columns: readonly (typeof COLUMNS)[number][];
}) {
  const summary = useStore(
    editor.form.store,
    (state) => lines.map((line) => state.values.lines[line.key]).filter(Boolean),
    (previous, next) =>
      previous.length === next.length && previous.every((line, index) => line === next[index]),
  );
  if (!summary.length) return null;
  return (
    <TableRow surface="muted">
      {columns.map(([id]) => (
        <TableCell key={id}>
          <InventoryColumnContent id={id} unit={editor.unit}>
            <InventoryCell id={id} editor={editor} line={summary[0]} summary={summary} />
          </InventoryColumnContent>
        </TableCell>
      ))}
    </TableRow>
  );
});

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
            <InventoryColumnContent id={id} unit={editor.unit}>
              <InventoryCell id={id} editor={editor} line={line} hideProduct={hideProduct} />
            </InventoryColumnContent>
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
  const error =
    id === 'count' && !summary && (editor.validationAttempted || line.quantity.doses.trim())
      ? inventoryLineError(line)
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
    case 'product': {
      const unit = line.orderable.dispensable?.displayUnit;
      const name = `${productName(line.orderable)}${unit ? ` - ${unit}` : ''}`;
      return hideProduct ? null : (
        <span className="block w-30 min-w-min whitespace-normal break-normal font-medium">
          <bdi>
            {Array.from(name.matchAll(/\S+|\s+/g), (match) =>
              match[0].trim() ? (
                <span key={match.index} className="whitespace-nowrap">
                  {match[0]}
                </span>
              ) : (
                match[0]
              ),
            )}
          </bdi>
        </span>
      );
    }
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
            size="xs"
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
          <div className="w-20">
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
  unit = 'DOSES',
}: {
  visibility: ColumnVisibilityState;
  showVvm?: boolean;
  showActions?: boolean;
  unit?: QuantityUnit;
}) {
  const { t } = useTranslation();
  const columns = visibleColumns(visibility, showVvm).filter(
    ([id]) => id !== 'actions' || showActions,
  );
  return (
    <div aria-busy>
      <DataTableCard>
        <Table density="compact" layout="auto">
          <colgroup>
            {columns.map(([id]) => (
              <col key={id} className={columnMinWidth(id, unit).width} />
            ))}
          </colgroup>
          <TableHeader surface="muted">
            <TableRow>
              {columns.map(([id, key]) => (
                <TableHead key={id} data-inventory-column={id}>
                  <InventoryColumnContent id={id} unit={unit}>
                    <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
                  </InventoryColumnContent>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2].map((row) => (
              <TableRow key={row}>
                {columns.map(([id]) => (
                  <TableCell key={id}>
                    <InventoryColumnContent id={id} unit={unit}>
                      <div className="h-4 w-full">
                        <Skeleton fill />
                      </div>
                    </InventoryColumnContent>
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
    <div data-inventory-key={line.key} className={cn('w-20', editor.unit === 'PACKS' && 'w-44')}>
      <Field data-invalid={Boolean(error)} spacing="tight">
        <FieldLabel>
          <span className="sr-only">{label}</span>
        </FieldLabel>
        <div className="flex gap-1">
          {parts.map((part) => (
            <div key={part} className="min-w-20 flex-1">
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
