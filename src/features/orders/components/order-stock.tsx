import { useTranslation } from 'react-i18next';
import { LoadError } from '@/components/app-shell/load-error';
import { Skeleton } from '@/components/ui/skeleton';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';

export function OrderStockBalance({
  value,
  loading,
  netContent,
  unit,
}: {
  value: number | null | undefined;
  loading: boolean;
  netContent?: number | null;
  unit: QuantityUnit;
}) {
  const { i18n } = useTranslation();
  if (value === undefined && loading)
    return (
      <span className="inline-block h-4 w-12">
        <Skeleton fill inline />
      </span>
    );
  return value == null ? null : cardQuantity(value, netContent, unit, i18n.language);
}

export function OrderStockError({ error, reset }: { error: unknown; reset: () => void }) {
  const { t } = useTranslation();
  return (
    <LoadError
      error={error}
      reset={reset}
      title={t('orders.edit.stock-error')}
      description={t('error.check-connection')}
    />
  );
}
