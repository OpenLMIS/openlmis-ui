import { RotateCcwIcon, WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { isOfflineError } from '@/lib/http';
import { useOnReconnect } from '@/lib/online';

export function useOfflineFailure(error: unknown, retry: () => void) {
  const offline = isOfflineError(error);
  useOnReconnect(() => {
    if (offline) retry();
  });
  return offline;
}

export function OfflineNotice({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <Empty height="screen">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WifiOffIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h2>{t('offline.notice-title')}</h2>
        </EmptyTitle>
        <EmptyDescription>{t('offline.notice-description')}</EmptyDescription>
      </EmptyHeader>
      <Button onClick={onRetry} size="sm" variant="secondary">
        <RotateCcwIcon />
        {t('error.try-again')}
      </Button>
    </Empty>
  );
}
