import { RotateCcwIcon, WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHasRight } from '@/components/nav-access';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { RIGHTS } from '@/features/auth/lib/rights';
import { isOfflineError } from '@/lib/http';
import { useOnReconnect } from '@/lib/online';

export function useOfflineFailure(error: unknown, retry: () => void) {
  const offline = isOfflineError(error);
  useOnReconnect(() => {
    if (offline) retry();
  });
  return offline;
}

export function OfflineNotice({
  onRetry,
  reason,
}: {
  onRetry: () => void;
  reason?: 'online-only';
}) {
  const { t } = useTranslation();

  return (
    <Empty height="screen">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WifiOffIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h2>{t(reason === 'online-only' ? 'offline.page-title' : 'offline.notice-title')}</h2>
        </EmptyTitle>
        <EmptyDescription>
          {reason === 'online-only' ? <OnlinePageDescription /> : t('offline.notice-description')}
        </EmptyDescription>
      </EmptyHeader>
      <Button onClick={onRetry} size="sm" variant="secondary">
        <RotateCcwIcon />
        {t('error.try-again')}
      </Button>
    </Empty>
  );
}

function OnlinePageDescription() {
  const { t } = useTranslation();
  const canAdjust = useHasRight(RIGHTS.stockAdjust);
  return t(canAdjust ? 'offline.page-description' : 'offline.page-description-generic');
}
