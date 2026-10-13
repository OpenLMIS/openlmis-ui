import { useTranslation } from 'react-i18next';
import { formatTimestamp } from '@/components/form/date-value';
import {
  RecordSummary,
  RecordSummaryField,
  RecordSummaryFieldSkeleton,
  RecordSummaryFields,
  RecordSummaryHeading,
} from '@/components/record-summary';
import { Skeleton } from '@/components/ui/skeleton';
import { eventTypeKey } from '@/features/stock-events/lib/event-list';
import type { StockEventSummary } from '@/features/stock-events/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { orEmpty } from '@/lib/empty-value';

export function EventHeader({
  event,
  showSignature = true,
}: {
  event: StockEventSummary;
  showSignature?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const typeKey = eventTypeKey(event.type);
  return (
    <RecordSummary aria-label={event.documentNumber ? undefined : t('stock-event.title')}>
      {event.documentNumber && (
        <RecordSummaryHeading>
          <span className="text-muted-foreground text-xs">{t('stock-event.document-number')}</span>
          <bdi className="break-words">{event.documentNumber}</bdi>
        </RecordSummaryHeading>
      )}
      <RecordSummaryFields>
        <RecordSummaryField label={t('stock-event.type')}>
          {orEmpty(typeKey && t(typeKey))}
        </RecordSummaryField>
        <RecordSummaryField label={t('stock-event.date')}>
          {orEmpty(formatTimestamp(event.processedDate, i18n.language, { time: true, timeZone }))}
        </RecordSummaryField>
        <RecordSummaryField label={t('stock-event.performed-by')}>
          {orEmpty(event.username)}
        </RecordSummaryField>
        {showSignature && (
          <RecordSummaryField label={t('stock-event.signature')}>
            {orEmpty(event.signature)}
          </RecordSummaryField>
        )}
      </RecordSummaryFields>
    </RecordSummary>
  );
}

const SKELETON_FIELDS = ['type', 'date', 'performedBy', 'signature'];

export function EventHeaderSkeleton() {
  return (
    <RecordSummary aria-busy>
      <RecordSummaryHeading>
        <div className="h-3 w-24">
          <Skeleton fill />
        </div>
        <div className="h-4 w-32">
          <Skeleton fill />
        </div>
      </RecordSummaryHeading>
      <RecordSummaryFields>
        {SKELETON_FIELDS.map((id) => (
          <RecordSummaryFieldSkeleton key={id} />
        ))}
      </RecordSummaryFields>
    </RecordSummary>
  );
}
