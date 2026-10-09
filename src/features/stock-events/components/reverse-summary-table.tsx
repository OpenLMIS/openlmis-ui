import { useTranslation } from 'react-i18next';
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
import { orEmpty } from '@/lib/empty-value';
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
    orEmpty(cardQuantity(value, line.orderable.netContent, unit, i18n.language));
  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <Table density="default" layout="auto">
        {unavailable && <TableCaption>{t('stock-event-reverse.summary-unavailable')}</TableCaption>}
        <TableHeader>
          <TableRow>
            <TableHead>{t('stock-event.product')}</TableHead>
            <TableHead>{t('stock-event.lot-code')}</TableHead>
            <TableHead>{t('stock-event.reason')}</TableHead>
            <TableHead>{t('stock-event.quantity')}</TableHead>
            <TableHead>
              {t(
                confirmation
                  ? 'stock-event-reverse.current-stock-on-hand'
                  : 'stock-event.stock-on-hand',
              )}
            </TableHead>
            {confirmation && <TableHead>{t('stock-event-reverse.new-stock-on-hand')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ line, reason, comments, current, balance }, index) => (
            <TableRow key={line.stockEventLineItemId ?? index}>
              <TableCell>
                <span className="block min-w-28 max-w-60 whitespace-normal">
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
                <span className="block min-w-28 max-w-60 whitespace-normal">
                  {orEmpty(namedWithFreeText(reason, comments))}
                </span>
              </TableCell>
              <TableCell>
                <span dir="ltr">{quantity(line.quantity, line)}</span>
              </TableCell>
              <TableCell>
                <span dir="ltr">{quantity(current, line)}</span>
              </TableCell>
              {confirmation && (
                <TableCell>
                  <span dir="ltr">{quantity(balance, line)}</span>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
