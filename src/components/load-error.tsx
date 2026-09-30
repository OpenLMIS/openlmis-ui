import { WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableError } from '@/components/data-table/data-table';
import { useOfflineFailure } from '@/components/offline-notice';

type LoadErrorProps = {
  error: unknown;
  reset: () => void;
  title: string;
  description: string;
};

export function LoadError({ error, reset, title, description }: LoadErrorProps) {
  const { t } = useTranslation();
  const offline = useOfflineFailure(error, reset);

  if (offline) {
    return (
      <DataTableError
        description={t('offline.notice-description')}
        icon={<WifiOffIcon />}
        onRetry={reset}
        title={t('offline.notice-title')}
      />
    );
  }
  return <DataTableError description={description} onRetry={reset} title={title} />;
}
