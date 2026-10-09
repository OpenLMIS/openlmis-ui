import type { ColumnVisibilityState } from '@tanstack/react-table';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import { formatDateValue } from '@/components/form/date-value';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { unaccounted } from '@/features/stock-events/lib/physical-inventory-form';
import type {
  InventoryCategoryBand,
  InventoryLine,
} from '@/features/stock-events/lib/physical-inventory-types';
import { orEmpty } from '@/lib/empty-value';
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
] as const;
type ColumnId = (typeof COLUMNS)[number][0];
export const INVENTORY_HIDEABLE_COLUMNS = [
  { id: 'productCode', labelKey: 'stock-events.product-code', hideBelow: 1100 },
  { id: 'packSize', labelKey: 'stock-events.pack-size', hideBelow: 1000 },
  { id: 'expiry', labelKey: 'stock-events.expiry-date', hideBelow: 900 },
] as const;
const visibleColumns = (visibility: ColumnVisibilityState, showVvm: boolean) =>
  COLUMNS.filter(([id]) => visibility[id] !== false && (id !== 'vvm' || showVvm));

type Props = {
  bands: readonly InventoryCategoryBand[];
  visibility: ColumnVisibilityState;
  showVvm: boolean;
};
export function PhysicalInventoryGrid({ bands, visibility, showVvm }: Props) {
  const { t } = useTranslation();
  const columns = visibleColumns(visibility, showVvm);
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
}: {
  id: ColumnId;
  line: InventoryLine;
  summary?: readonly InventoryLine[];
  hideProduct?: boolean;
  hasLot?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const format = new Intl.NumberFormat(i18n.language).format;
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
            line.lot?.expirationDate
              ? formatDateValue(line.lot.expirationDate, i18n.language)
              : null,
          )}
        </bdi>
      );
    case 'stock':
      return number(total((item) => item.stockOnHand));
    case 'count':
      return number(total((item) => toOptionalWholeNumber(item.quantity.doses)));
    case 'unaccounted':
      return summary ? null : number(unaccounted(line));
    case 'reasons':
      return summary ? null : (
        <span className="block max-w-48 whitespace-normal break-words">
          {line.stockAdjustments
            .map((adjustment) => adjustment.reason.name ?? adjustment.reason.id)
            .join(', ')}
        </span>
      );
    case 'vvm':
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
