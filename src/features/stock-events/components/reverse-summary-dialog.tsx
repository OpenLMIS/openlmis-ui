import { useTranslation } from 'react-i18next';
import {
  FormDialog,
  FormDialogBody,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { Button } from '@/components/ui/button';
import { ReverseSummaryTable } from '@/features/stock-events/components/reverse-summary-table';
import type { StockEventLine } from '@/features/stock-events/lib/types';
import type { QuantityUnit } from '@/lib/quantity';

export function ReverseSummaryDialog({
  open,
  onClose,
  lines,
  unavailable,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  lines: StockEventLine[];
  unavailable: boolean;
  unit: QuantityUnit;
}) {
  const { t } = useTranslation();
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="2xl"
    >
      <FormDialogHeader>
        <FormDialogTitle>{t('stock-event-reverse.summary-title')}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <ReverseSummaryTable
          unit={unit}
          unavailable={unavailable}
          rows={lines.map((line) => ({
            line,
            reason: line.reason,
            comments: line.reasonFreeText,
            current: line.stockOnHand,
          }))}
        />
      </FormDialogBody>
      <FormDialogFooter>
        <Button onClick={onClose}>{t('stock-event-reverse.close')}</Button>
      </FormDialogFooter>
    </FormDialog>
  );
}
