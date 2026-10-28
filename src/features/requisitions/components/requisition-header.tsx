import { useSuspenseQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDateValue } from '@/components/form/date-value';
import {
  RecordSummary,
  RecordSummaryField,
  RecordSummaryFields,
  RecordSummaryHeading,
} from '@/components/record-summary';
import { Badge } from '@/components/ui/badge';
import { facilityOptions, processingPeriodOptions } from '@/features/reference-data/api/queries';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { orEmpty } from '@/lib/empty-value';
import { REQUISITION_STATUS } from '@/lib/requisition-status';

export function RequisitionHeader({ record }: { record: RequisitionRecord }) {
  const { t, i18n } = useTranslation();
  const [{ data: facility }, { data: period }] = useSuspenseQueries({
    queries: [
      facilityOptions(record.facility.id),
      processingPeriodOptions(record.processingPeriod.id),
    ],
  });
  const zone = facility.geographicZone;
  const status = REQUISITION_STATUS[record.status];
  const StatusIcon = status.icon;
  return (
    <RecordSummary>
      <RecordSummaryHeading>
        {t(
          record.emergency
            ? 'requisitions.requisition.emergency'
            : record.reportOnly
              ? 'requisitions.requisition.report-only'
              : 'requisitions.requisition.regular',
        )}
      </RecordSummaryHeading>
      <RecordSummaryFields>
        <RecordSummaryField label={t('requisitions.requisition.facility')}>
          {facility.code} - {facility.name}
        </RecordSummaryField>
        <RecordSummaryField label={t('requisitions.requisition.operated-by')}>
          {orEmpty(facility.operator?.name)}
        </RecordSummaryField>
        <RecordSummaryField label={t('requisitions.requisition.district')}>
          {orEmpty(zone?.name)}
        </RecordSummaryField>
        <RecordSummaryField label={t('requisitions.requisition.region')}>
          {orEmpty(zone?.parent?.name)}
        </RecordSummaryField>
        {zone?.parent?.parent && (
          <RecordSummaryField label={t('requisitions.requisition.province')}>
            {orEmpty(zone.parent.parent.name)}
          </RecordSummaryField>
        )}
        <RecordSummaryField label={t('requisitions.requisition.period')}>
          {t('requisitions.requisition.period-range', {
            start: formatDateValue(period.startDate, i18n.language),
            end: formatDateValue(period.endDate, i18n.language),
          })}
        </RecordSummaryField>
        {record.datePhysicalStockCountCompleted && (
          <RecordSummaryField label={t('requisitions.requisition.physical-count-date')}>
            {formatDateValue(record.datePhysicalStockCountCompleted, i18n.language)}
          </RecordSummaryField>
        )}
        <RecordSummaryField label={t('requisitions.requisition.status')}>
          <Badge variant={status.tone}>
            <StatusIcon data-icon="inline-start" />
            {t(status.labelKey)}
          </Badge>
        </RecordSummaryField>
      </RecordSummaryFields>
    </RecordSummary>
  );
}
