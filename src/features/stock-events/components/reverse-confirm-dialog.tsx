import { useTranslation } from 'react-i18next';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { Button } from '@/components/ui/button';
import { ReverseSummaryTable } from '@/features/stock-events/components/reverse-summary-table';
import { type ReverseRow, reverseRowId } from '@/features/stock-events/lib/event-reverse';
import type { EventStockOnHand, StockEventLineReason } from '@/features/stock-events/lib/types';
import type { QuantityUnit } from '@/lib/quantity';

export function ReverseConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  rows,
  reasons,
  current,
  balances,
  unit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  rows: (ReverseRow & { id?: string })[];
  reasons: readonly StockEventLineReason[];
  current: EventStockOnHand;
  balances: Record<string, number>;
  unit: QuantityUnit;
}) {
  const { t } = useTranslation();
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size="xl">
      <FormDialogHeader>
        <FormDialogTitle>{t('stock-event-reverse.confirm-title')}</FormDialogTitle>
        <FormDialogDescription>
          {t('stock-event-reverse.confirm-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <ReverseSummaryTable
          confirmation
          unit={unit}
          rows={rows.map((row, index) => ({
            line: row.line,
            reason: reasons.find((reason) => reason.id === row.reasonId),
            comments: row.comments,
            current:
              current[`${row.line.orderable.id}/${row.line.lot?.id ?? ''}`] ?? row.line.stockOnHand,
            balance: balances[row.id ?? reverseRowId(row.line, index)],
          }))}
        />
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('stock-events.cancel')}</FormDialogCancel>
        <Button onClick={onConfirm}>{t('stock-events.confirm')}</Button>
      </FormDialogFooter>
    </FormDialog>
  );
}
