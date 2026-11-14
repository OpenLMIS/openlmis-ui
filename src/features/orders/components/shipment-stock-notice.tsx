import { CircleAlertIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ShipmentStockNotice() {
  const { t } = useTranslation();
  return (
    <span
      role="note"
      className="inline-flex items-center gap-2 text-warning-strong whitespace-normal"
    >
      <CircleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
      {t('orders.shipment.no-stock')}
    </span>
  );
}
