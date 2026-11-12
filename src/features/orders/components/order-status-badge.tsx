import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { type OrderStatus, orderStatusKey } from '@/features/orders/lib/order-status';

const STATUS_TONES: Record<
  OrderStatus,
  'secondary' | 'info' | 'warning' | 'success' | 'destructive'
> = {
  CREATING: 'secondary',
  ORDERED: 'info',
  FULFILLING: 'warning',
  SHIPPED: 'info',
  RECEIVED: 'success',
  TRANSFER_FAILED: 'destructive',
  IN_ROUTE: 'info',
  READY_TO_PACK: 'warning',
  CANCELLED: 'secondary',
};

export function OrderStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const key = orderStatusKey(status);
  return (
    <Badge variant={key ? STATUS_TONES[status as OrderStatus] : 'secondary'} wrap="normal">
      {key ? t(key) : status}
    </Badge>
  );
}
