import { memo, type ReactNode } from 'react';
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
import { OrderStatusBadge } from '@/features/orders/components/order-status-badge';
import type { Order } from '@/features/orders/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { orEmpty } from '@/lib/empty-value';

export const OrderHeader = memo(function OrderHeader({
  order,
  cceStatus,
}: {
  order: Order;
  cceStatus?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const shipment = cceStatus !== undefined;
  return (
    <RecordSummary aria-label={shipment ? t('orders.shipment.crumb') : undefined}>
      {shipment ? (
        <RecordSummaryHeading>
          <span className="font-normal text-muted-foreground text-xs">
            {t('orders.view.columns.order-code')}
          </span>
          <span className="break-words">
            <bdi>{order.orderCode ?? order.id}</bdi>
          </span>
          {order.emergency && <Badge variant="destructive">{t('orders.shipment.emergency')}</Badge>}
        </RecordSummaryHeading>
      ) : (
        <RecordSummaryHeading>
          <span className="font-normal text-muted-foreground text-xs">
            {t('orders.edit.requesting-facility')}
          </span>
          <span className="break-words">
            <bdi>{order.requestingFacility.name ?? order.requestingFacility.id}</bdi>
          </span>
        </RecordSummaryHeading>
      )}
      <RecordSummaryFields>
        {!shipment && order.emergency && (
          <RecordSummaryField label={t('orders.shipment.emergency')}>
            <Badge variant="destructive">{t('orders.shipment.emergency')}</Badge>
          </RecordSummaryField>
        )}
        <RecordSummaryField label={t('orders.edit.status')}>
          <OrderStatusBadge status={order.status} />
        </RecordSummaryField>
        <RecordSummaryField label={t('orders.edit.date-created')}>
          {orEmpty(formatTimestamp(order.createdDate, i18n.language, { timeZone }))}
        </RecordSummaryField>
        <RecordSummaryField label={t('orders.edit.program')}>
          {order.program.name ?? order.program.id}
        </RecordSummaryField>
        {shipment ? (
          <>
            <RecordSummaryField label={t('orders.shipment.facility')}>
              {order.requestingFacility.name ?? order.requestingFacility.id}
            </RecordSummaryField>
            <RecordSummaryField label={t('orders.shipment.cce-status')}>
              {cceStatus}
            </RecordSummaryField>
          </>
        ) : (
          <RecordSummaryField label={t('orders.edit.supplying-facility')}>
            {order.supplyingFacility.name ?? order.supplyingFacility.id}
          </RecordSummaryField>
        )}
      </RecordSummaryFields>
    </RecordSummary>
  );
});

export function OrderHeaderSkeleton({ kind = 'order' }: { kind?: 'order' | 'shipment' }) {
  const { t } = useTranslation();
  return (
    <RecordSummary aria-busy>
      <RecordSummaryHeading>
        <span className="font-normal text-muted-foreground text-xs">
          {t(
            kind === 'shipment'
              ? 'orders.view.columns.order-code'
              : 'orders.edit.requesting-facility',
          )}
        </span>
        <div className="h-5 w-40">
          <Skeleton fill />
        </div>
      </RecordSummaryHeading>
      <RecordSummaryFields>
        {(['status', 'date-created', 'program'] as const).map((key) => (
          <RecordSummaryFieldSkeleton key={key} label={t(`orders.edit.${key}`)} />
        ))}
        {kind === 'shipment' ? (
          <>
            <RecordSummaryFieldSkeleton label={t('orders.shipment.facility')} />
            <RecordSummaryFieldSkeleton label={t('orders.shipment.cce-status')} />
          </>
        ) : (
          <RecordSummaryFieldSkeleton label={t('orders.edit.supplying-facility')} />
        )}
      </RecordSummaryFields>
    </RecordSummary>
  );
}
