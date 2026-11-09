import { FilePenIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RecordSummary,
  RecordSummaryField,
  RecordSummaryFieldSkeleton,
  RecordSummaryFields,
  RecordSummaryHeading,
} from '@/components/display/record-summary';
import { formatTimestamp } from '@/components/form/date-value';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ORDER_STATUS, type OrderStatus } from '@/features/orders/lib/order-status';
import type { Order } from '@/features/orders/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { orEmpty } from '@/lib/empty-value';

export const OrderHeader = memo(function OrderHeader({ order }: { order: Order }) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  return (
    <RecordSummary>
      <RecordSummaryHeading>
        <span className="font-normal text-muted-foreground text-xs">
          {t('orders.edit.requesting-facility')}
        </span>
        <span className="break-words">
          <bdi>{order.requestingFacility.name ?? order.requestingFacility.id}</bdi>
        </span>
      </RecordSummaryHeading>
      <RecordSummaryFields>
        <RecordSummaryField label={t('orders.edit.status')}>
          <Badge variant="secondary">
            <FilePenIcon data-icon="inline-start" />
            {ORDER_STATUS[order.status as OrderStatus]
              ? t(ORDER_STATUS[order.status as OrderStatus].labelKey)
              : order.status}
          </Badge>
        </RecordSummaryField>
        <RecordSummaryField label={t('orders.edit.date-created')}>
          {orEmpty(formatTimestamp(order.createdDate, i18n.language, { timeZone }))}
        </RecordSummaryField>
        <RecordSummaryField label={t('orders.edit.program')}>
          {order.program.name ?? order.program.id}
        </RecordSummaryField>
        <RecordSummaryField label={t('orders.edit.supplying-facility')}>
          {order.supplyingFacility.name ?? order.supplyingFacility.id}
        </RecordSummaryField>
      </RecordSummaryFields>
    </RecordSummary>
  );
});

export function OrderHeaderSkeleton() {
  const { t } = useTranslation();
  return (
    <RecordSummary aria-busy>
      <RecordSummaryHeading>
        <span className="font-normal text-muted-foreground text-xs">
          {t('orders.edit.requesting-facility')}
        </span>
        <div className="h-5 w-40">
          <Skeleton fill />
        </div>
      </RecordSummaryHeading>
      <RecordSummaryFields>
        {(['status', 'date-created', 'program', 'supplying-facility'] as const).map((key) => (
          <RecordSummaryFieldSkeleton key={key} label={t(`orders.edit.${key}`)} />
        ))}
      </RecordSummaryFields>
    </RecordSummary>
  );
}
