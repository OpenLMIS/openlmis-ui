import { RotateCcwIcon, WifiOffIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
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
import { useOnline } from '@/lib/online';

/** A failure that a connection would fix: no answer at all, or anything while offline. */
export function useIsOfflineFailure(error: unknown) {
  const online = useOnline();
  return isOfflineError(error) || !online;
}

/** Calls `retry` when the connection comes back, so a page fills in by itself. */
export function useRetryWhenOnline(retry: () => void) {
  const online = useOnline();
  const wasOnline = useRef(online);
  const latestRetry = useRef(retry);
  latestRetry.current = retry;

  useEffect(() => {
    if (online && !wasOnline.current) latestRetry.current();
    wasOnline.current = online;
  }, [online]);
}

type OfflineNoticeProps = {
  onRetry?: () => void;
  height?: 'default' | 'screen';
};

/** In place of data that has not been downloaded to this device and cannot be fetched offline. */
export function OfflineNotice({ onRetry, height = 'default' }: OfflineNoticeProps) {
  const { t } = useTranslation();
  useRetryWhenOnline(() => onRetry?.());

  return (
    <Empty height={height}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WifiOffIcon />
        </EmptyMedia>
        <EmptyTitle>
          <h2>{t('offline.notice-title')}</h2>
        </EmptyTitle>
        <EmptyDescription>{t('offline.notice-description')}</EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="secondary">
          <RotateCcwIcon />
          {t('error.try-again')}
        </Button>
      )}
    </Empty>
  );
}
