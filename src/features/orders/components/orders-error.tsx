import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';

export function OrdersError({ error, reset }: { error: unknown; reset: () => void }) {
  const { t } = useTranslation();
  return (
    <ListError
      error={error}
      reset={reset}
      title={t('orders.view.error-title')}
      description={t('orders.view.error-description')}
    />
  );
}
