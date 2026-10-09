import type { ColumnVisibilityState } from '@tanstack/react-table';
import { EllipsisIcon } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import { formatDateValue } from '@/components/form/date-value';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PhysicalInventoryForm } from '@/features/stock-events/hooks/use-physical-inventory-form';
import { unaccounted } from '@/features/stock-events/lib/physical-inventory-form';
import { canDeactivateInventoryLine } from '@/features/stock-events/lib/physical-inventory-products';
import type {
  InventoryCategoryBand,
  InventoryLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import { orEmpty } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { toOptionalWholeNumber } from '@/lib/whole-number';

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
  { id: 'productCode', labelKey: 'stock-events.product-code', hideBelow: 1100 },
  { id: 'packSize', labelKey: 'stock-events.pack-size', hideBelow: 1000 },
  { id: 'expiry', labelKey: 'stock-events.expiry-date', hideBelow: 900 },
] as const;
const visibleColumns = (visibility: ColumnVisibilityState, showVvm: boolean) =>
  COLUMNS.filter(([id]) => visibility[id] !== false && (id !== 'vvm' || showVvm));

export type InventoryGridEditor = {
  form: PhysicalInventoryForm;
  unit: QuantityUnit;
  online: boolean;
  reasonsReady: boolean;
  pending: boolean;
  onReasons: (line: InventoryLine) => void;
  onEditLot: (line: InventoryLine) => void;
  onRemove: (line: InventoryLine) => void;
  onDeactivate: (line: InventoryLine) => void;
};
type Props = {
  editor?: InventoryGridEditor;
  bands: readonly InventoryCategoryBand[];
  visibility: ColumnVisibilityState;
  showVvm: boolean;
};
export function PhysicalInventoryGrid({ bands, visibility, showVvm, editor }: Props) {
  const { t } = useTranslation();
  const columns = visibleColumns(visibility, showVvm).filter(
    ([id]) =>
      id !== 'actions' ||
      bands.some((band) =>
        band.groups.some((group) =>
          group.lines.some(
            (line) => line.justAdded || (editor && canDeactivateInventoryLine(line, editor.online)),
          ),
        ),
      ),
  );
  return (
    <DataTableCard>
      <Table density="comfortable" layout="auto">
        <TableHeader surface="muted">
          <TableRow>
            {columns.map(([id, key]) => (
              <TableHead key={id}>
                <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
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
                          <InventoryCell id={id} line={group.lines[0]} summary={group.lines} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ) : null}
                  {group.lines.map((line) => (
                    <TableRow key={line.key}>
                      {columns.map(([id]) => (
                        <TableCell key={id}>
                          <InventoryCell
                            id={id}
                            editor={editor}
                            line={line}
                            hideProduct={group.lines.length > 1}
                            hasLot={group.lines.some((item) => item.lot || item.newLot)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
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

function InventoryCell({
  id,
  line,
  summary,
  hideProduct,
  hasLot,
  editor,
}: {
  editor?: InventoryGridEditor;
  id: ColumnId;
  line: InventoryLine;
  summary?: readonly InventoryLine[];
  hideProduct?: boolean;
  hasLot?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const format = new Intl.NumberFormat(i18n.language).format;
  const row = `${line.orderable.fullProductName || line.orderable.productCode} ${line.lot?.lotCode ?? line.newLot?.lotCode ?? t('stock-events.no-lot-defined')}`;
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
        <span className="block min-w-28 max-w-48 whitespace-normal break-words font-medium">
          <bdi>
            {line.orderable.fullProductName || line.orderable.productCode}
            {line.orderable.dispensable?.displayUnit
              ? ` - ${line.orderable.dispensable.displayUnit}`
              : ''}
          </bdi>
        </span>
      );
    case 'packSize':
      return hideProduct ? null : number(line.orderable.netContent);
    case 'lot':
      if (!summary && line.newLot && editor)
        return (
          <Button variant="link" type="button" onClick={() => editor.onEditLot(line)}>
            {line.newLot.lotCode}
          </Button>
        );
      return summary ? null : (
        <bdi>
          {line.lot?.lotCode ??
            line.newLot?.lotCode ??
            t(hasLot ? 'stock-events.no-lot-defined' : 'stock-events.product-has-no-lots')}
        </bdi>
      );
    case 'expiry':
      return summary ? null : (
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
      );
    case 'stock':
      return (
        <bdi dir="ltr">
          {orEmpty(
            cardQuantity(
              total((item) => item.stockOnHand),
              line.orderable.netContent,
              editor?.unit ?? 'DOSES',
              i18n.language,
            ),
          )}
        </bdi>
      );
    case 'count':
      if (!summary && editor)
        return (
          <div className={editor.unit === 'PACKS' ? 'w-28' : 'w-20'}>
            <editor.form.AppField name={`lines.${line.key}.quantity`}>
              {(field) => (
                <field.QuantityField
                  label={label(t('physical-inventory.current-stock'))}
                  layout="inline"
                  unit={editor.unit}
                  netContent={line.orderable.netContent}
                  dosesLabel={t('quantity-unit.doses')}
                  packsLabel={t('quantity-unit.packs')}
                  disabled={editor.pending}
                />
              )}
            </editor.form.AppField>
          </div>
        );
      return (
        <bdi dir="ltr">
          {orEmpty(
            cardQuantity(
              total((item) => toOptionalWholeNumber(item.quantity.doses)),
              line.orderable.netContent,
              editor?.unit ?? 'DOSES',
              i18n.language,
            ),
          )}
        </bdi>
      );
    case 'unaccounted':
      return summary ? null : (
        <bdi dir="ltr">
          {orEmpty(
            cardQuantity(
              unaccounted(line),
              line.orderable.netContent,
              editor?.unit ?? 'DOSES',
              i18n.language,
            ),
          )}
        </bdi>
      );
    case 'reasons':
      if (!summary && editor)
        return (
          <Button
            type="button"
            variant="outline"
            disabled={editor.pending || !line.quantity.doses.trim()}
            onClick={() => editor.onReasons(line)}
          >
            {line.stockAdjustments.length === 0
              ? t('physical-inventory.add-reasons')
              : line.stockAdjustments.length === 1
                ? (line.stockAdjustments[0].reason.name ?? line.stockAdjustments[0].reason.id)
                : t('physical-inventory.reason-count', { count: line.stockAdjustments.length })}
          </Button>
        );
      return summary ? null : (
        <span className="block max-w-48 whitespace-normal break-words">
          {line.stockAdjustments
            .map((adjustment) => adjustment.reason.name ?? adjustment.reason.id)
            .join(', ')}
        </span>
      );
    case 'actions':
      if (
        summary ||
        !editor ||
        (!line.justAdded && !canDeactivateInventoryLine(line, editor.online))
      )
        return null;
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
                <DropdownMenuItem onClick={() => editor.onDeactivate(line)}>
                  {t('physical-inventory.deactivate')}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    case 'vvm':
      if (!summary && editor && line.orderable.extraData?.useVVM === 'true')
        return (
          <div className="w-24">
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
      return summary || line.orderable.extraData?.useVVM !== 'true'
        ? null
        : line.vvmStatus === 'STAGE_1'
          ? t('stock-events.stage-1')
          : line.vvmStatus === 'STAGE_2'
            ? t('stock-events.stage-2')
            : orEmpty(null);
  }
}

export function PhysicalInventoryGridSkeleton({
  visibility,
}: {
  visibility: ColumnVisibilityState;
}) {
  const { t } = useTranslation();
  const columns = visibleColumns(visibility, false);
  return (
    <div aria-busy>
      <DataTableCard>
        <Table density="comfortable">
          <TableHeader surface="muted">
            <TableRow>
              {columns.map(([id, key]) => (
                <TableHead key={id}>
                  <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2].map((row) => (
              <TableRow key={row}>
                {columns.map(([id]) => (
                  <TableCell key={id}>
                    <div className="h-4 w-20">
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
