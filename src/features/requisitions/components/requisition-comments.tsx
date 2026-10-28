import { useSuspenseQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
  const headingId = useId();
  const { data } = useSuspenseQuery(requisitionStatusMessagesOptions(record.id));
  const messages = data.toSorted((a, b) => b.createdDate.localeCompare(a.createdDate));
  const latest = messages[0];
  const rejected = latestRejection(record);
  const hasRejections = record.status === 'REJECTED' && !!rejected?.rejectionDtos?.length;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-semibold text-sm" id={headingId}>
          {t('requisitions.requisition.comments')}
        </h2>
        <div className="min-w-8 flex-1">
          <Separator />
        </div>
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
      <div className="rounded-lg border bg-muted/50 px-4 py-3">
        {latest ? (
          <StatusMessage message={latest} />
        ) : (
          <p className="text-sm">{t('requisitions.requisition.no-comments')}</p>
        )}
      </div>
      <RequisitionHistoryDialog messages={messages} open={!!history} onClose={onClose} />
      {hasRejections && (
        <RejectionReasonsDialog rejection={rejected} open={!!rejection} onClose={onClose} />
      )}
    </section>
  );
}
