import { WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableError } from '@/components/data-table/data-table';
import { NoAccess } from '@/components/no-access-page';
import { useOfflineFailure } from '@/components/offline-notice';
import { isForbidden } from '@/features/auth/lib/access';

type ListErrorProps = {
  error: unknown;
  reset: () => void;
  title: string;
  description: string;
};

/** What a list shows when its rows could not load: No Access, a connection to find, or an error. */
export function ListError({ error, reset, title, description }: ListErrorProps) {
  const { t } = useTranslation();
  const offline = useOfflineFailure(error, reset);

  // Rights read at sign in can be revoked since; the server's refusal says so.
  if (isForbidden(error)) return <NoAccess />;
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
