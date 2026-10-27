import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { requisitionStatusMessagesOptions } from '@/features/requisitions/api/queries';
import {
  latestRejection,
  RejectionReasonsDialog,
} from '@/features/requisitions/components/rejection-reasons-dialog';
import {
  RequisitionHistoryDialog,
  StatusMessage,
} from '@/features/requisitions/components/requisition-history-dialog';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';

export function RequisitionComments({
  record,
  history,
  rejection,
  onHistory,
  onRejection,
  onClose,
}: {
  record: RequisitionRecord;
  history?: boolean;
  rejection?: boolean;
  onHistory: () => void;
  onRejection: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(requisitionStatusMessagesOptions(record.id));
  const messages = data.toSorted((a, b) => b.createdDate.localeCompare(a.createdDate));
  const latest = messages[0];
  const hasRejections =
    record.status === 'REJECTED' && !!latestRejection(record)?.rejectionDtos?.length;
  return (
    <section aria-label={t('requisitions.requisition.comments')} className="flex flex-col gap-2">
      <h2 className="font-semibold text-sm">{t('requisitions.requisition.comments')}</h2>
      {latest ? (
        <StatusMessage message={latest} />
      ) : (
        <p className="text-muted-foreground text-sm">{t('requisitions.requisition.no-comments')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {messages.length > 0 && (
          <Button variant="outline" size="lg" onClick={onHistory}>
            {t('requisitions.requisition.view-history')}
          </Button>
        )}
        {hasRejections && (
          <Button variant="outline" size="lg" onClick={onRejection}>
            {t('requisitions.requisition.view-rejection')}
          </Button>
        )}
      </div>
      <RequisitionHistoryDialog messages={messages} open={!!history} onClose={onClose} />
      {hasRejections && (
        <RejectionReasonsDialog record={record} open={!!rejection} onClose={onClose} />
      )}
    </section>
  );
}
