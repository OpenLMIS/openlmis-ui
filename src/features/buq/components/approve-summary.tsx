import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  RecordSummary,
  RecordSummaryField,
  RecordSummaryFieldSkeleton,
  RecordSummaryFields,
} from '@/components/display/record-summary';
import { buqApproveStatsOptions } from '@/features/buq/api/queries';

export function ApproveSummary({ programId }: { programId: string }) {
  const { t, i18n } = useTranslation();
  const { data } = useSuspenseQuery(buqApproveStatsOptions(programId));
  const count = new Intl.NumberFormat(i18n.language);
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' });
  return (
    <RecordSummary aria-label={t('buq.approve.summary')}>
      <RecordSummaryFields>
        <RecordSummaryField label={t('buq.approve.total-facilities')}>
          {count.format(data.totalFacilities)}
        </RecordSummaryField>
        <RecordSummaryField label={t('buq.approve.total-submitted')}>
          {count.format(data.totalSubmitted)}
        </RecordSummaryField>
        <RecordSummaryField label={t('buq.approve.percentage-submitted')}>
          {percent.format(data.percentageSubmitted / 100)}
        </RecordSummaryField>
      </RecordSummaryFields>
    </RecordSummary>
  );
}

export function ApproveSummarySkeleton() {
  const { t } = useTranslation();
  return (
    <RecordSummary aria-busy>
      <RecordSummaryFields>
        <RecordSummaryFieldSkeleton label={t('buq.approve.total-facilities')} />
        <RecordSummaryFieldSkeleton label={t('buq.approve.total-submitted')} />
        <RecordSummaryFieldSkeleton label={t('buq.approve.percentage-submitted')} />
      </RecordSummaryFields>
    </RecordSummary>
  );
}
