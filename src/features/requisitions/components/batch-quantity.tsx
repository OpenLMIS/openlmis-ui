import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { TableCell } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBatch, useBatchVersion } from '@/features/requisitions/components/batch-context';
import {
  batchApprovable,
  batchCost,
  batchLabel,
  lineInvalid,
  validateBatchQuantity,
} from '@/features/requisitions/lib/batch';
import type { BatchLine, BatchRequisition } from '@/features/requisitions/lib/batch-types';
import { formatCurrency } from '@/features/requisitions/lib/currency';

export const batchFieldId = (recordId: string, lineId: string) => `batch-${recordId}-${lineId}`;
export const BatchQuantity = memo(function BatchQuantity({
  record,
  line,
  controlSize,
}: {
  record: BatchRequisition;
  controlSize?: 'sm';
  line: BatchLine;
}) {
  const { t } = useTranslation();
  const { drafts, disabled } = useBatch();
  useBatchVersion(`${record.id}:${line.id}`);
  useBatchVersion('meta');
  const [open, setOpen] = useState(false);
  if (line.skipped) return <span>{t('requisitions.batch.skipped')}</span>;
  const value = drafts.text(record.id, line);
  const error = validateBatchQuantity(value);
  const id = batchFieldId(record.id, line.id);
  return (
    <Field spacing="tight" surface="background" data-invalid={!!error}>
      <span className="sr-only" id={`${id}-error`}>
        {error ? t(error) : ''}
      </span>
      <Tooltip disabled={!error} open={!!error && open} onOpenChange={setOpen}>
        <TooltipTrigger
          render={<div className="min-w-24" />}
          tabIndex={-1}
          onFocusCapture={() => setOpen(true)}
          onBlurCapture={() => setOpen(false)}
        >
          <Input
            id={id}
            aria-label={t('requisitions.batch.quantity-label', {
              facility: batchLabel(record),
              code: line.orderable.productCode,
            })}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            controlSize={controlSize}
            sizing="full-minimum"
            inputMode="numeric"
            value={value}
            disabled={
              disabled ||
              !batchApprovable(record) ||
              !drafts.ready() ||
              drafts.outdated(record.id) ||
              drafts.unresolved(record.id)
            }
            onChange={(event) => drafts.set(record.id, line.id, event.target.value)}
          />
        </TooltipTrigger>
        <TooltipContent>{error ? t(error) : ''}</TooltipContent>
      </Tooltip>
    </Field>
  );
});
export const BatchCost = memo(function BatchCost({
  recordId,
  line,
}: {
  recordId: string;
  line: BatchLine;
}) {
  const { drafts, currency } = useBatch();
  useBatchVersion(`${recordId}:${line.id}`);
  return <>{formatCurrency(batchCost(line, drafts.text(recordId, line)), currency)}</>;
});

export const BatchInputCell = memo(function BatchInputCell({
  record,
  line,
}: {
  record: BatchRequisition;
  line?: BatchLine;
}) {
  const { drafts } = useBatch();
  useBatchVersion(`${record.id}:${line?.id ?? ''}`);
  const invalid = line && lineInvalid(line, drafts.text(record.id, line));
  return (
    <TableCell tone={invalid ? 'danger' : 'default'}>
      {line && <BatchQuantity record={record} line={line} controlSize="sm" />}
    </TableCell>
  );
});
