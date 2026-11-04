import { TriangleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBatch, useBatchVersion } from '@/features/requisitions/components/batch-context';
import { batchApprovable, lineInvalid } from '@/features/requisitions/lib/batch';
import type { BatchRequisition } from '@/features/requisitions/lib/batch-types';

export function BatchRecordStatus({ record }: { record: BatchRequisition }) {
  const { t } = useTranslation();
  const { drafts, reasons } = useBatch();
  useBatchVersion(`record:${record.id}`);
  useBatchVersion('meta');
  const invalid = record.requisitionLineItems.some((line) =>
    lineInvalid(line, drafts.text(record.id, line)),
  );
  const reason = reasons.get(record.id);
  if (!batchApprovable(record))
    return (
      <span className="text-muted-foreground text-xs">
        {t('requisitions.batch.no-longer-awaiting')}
      </span>
    );
  if (!invalid && !reason) return null;
  return (
    <span className="flex items-center gap-1 text-destructive text-xs">
      <TriangleAlertIcon className="size-4 shrink-0" />
      {reason === 'requisitions.batch.no-longer-awaiting'
        ? t(reason)
        : reason || t('requisitions.batch.invalid-requisition')}
    </span>
  );
}
