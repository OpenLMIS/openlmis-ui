import { useTranslation } from 'react-i18next';
import { DataTableHeaderLabel } from '@/components/data-table/data-table';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StockEventLine } from '@/features/stock-events/lib/types';
import { tableValue } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { namedWithFreeText } from '@/lib/stock-labels';

type ReverseSummaryLine = {
  line: StockEventLine;
  reason?: { name: string } | null;
  comments?: string | null;
  current: number;
  balance?: number;
};
export function ReverseSummaryTable({
  rows,
  unit,
  confirmation = false,
  unavailable = false,
}: {
  rows: ReverseSummaryLine[];
  unit: QuantityUnit;
  confirmation?: boolean;
  unavailable?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const quantity = (value: number | undefined, line: StockEventLine) =>
    tableValue(cardQuantity(value, line.orderable.netContent, unit, i18n.language));
  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <Table density="default" layout="auto">
        {unavailable && <TableCaption>{t('stock-event-reverse.summary-unavailable')}</TableCaption>}
        <TableHeader>
          <TableRow>
            <TableHead>
              <DataTableHeaderLabel>{t('stock-event.product')}</DataTableHeaderLabel>
            </TableHead>
            <TableHead>
              <DataTableHeaderLabel>{t('stock-event.lot-code')}</DataTableHeaderLabel>
            </TableHead>
            <TableHead>
              <DataTableHeaderLabel>{t('stock-event.reason')}</DataTableHeaderLabel>
            </TableHead>
            <TableHead>
              <DataTableHeaderLabel>{t('stock-event.quantity')}</DataTableHeaderLabel>
            </TableHead>
            <TableHead>
              <DataTableHeaderLabel>
                {t(
                  confirmation
                    ? 'stock-event-reverse.current-stock-on-hand'
                    : 'stock-event.stock-on-hand',
                )}
              </DataTableHeaderLabel>
            </TableHead>
            {confirmation && (
              <TableHead>
                <DataTableHeaderLabel>
                  {t('stock-event-reverse.new-stock-on-hand')}
                </DataTableHeaderLabel>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ line, reason, comments, current, balance }, index) => (
            <TableRow key={line.stockEventLineItemId ?? index}>
              <TableCell>
                <span className="whitespace-nowrap">
                  <bdi>{line.orderable.fullProductName}</bdi>{' '}
                  <bdi className="whitespace-nowrap">({line.orderable.productCode})</bdi>
                </span>
              </TableCell>
              <TableCell>
                <bdi className="whitespace-nowrap">
                  {line.lot?.lotCode ?? t('stock-event.no-lot')}
                </bdi>
              </TableCell>
              <TableCell>
                <span className="whitespace-nowrap">
                  {tableValue(namedWithFreeText(reason, comments))}
                </span>
              </TableCell>
              <TableCell>
                <span className="whitespace-nowrap" dir="ltr">
                  {quantity(line.quantity, line)}
                </span>
              </TableCell>
              <TableCell>
                <span className="whitespace-nowrap" dir="ltr">
                  {quantity(current, line)}
                </span>
              </TableCell>
              {confirmation && (
                <TableCell>
                  <span className="whitespace-nowrap" dir="ltr">
                    {quantity(balance, line)}
                  </span>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
