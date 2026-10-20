import { RotateCcwIcon, WifiOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useHasOfflineCapability } from '@/components/nav-access';
import { StatusPage } from '@/components/status-page';
import { Button } from '@/components/ui/button';
import { EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { isOfflineError } from '@/lib/http';
import { isOnline, useOnReconnect } from '@/lib/online';

export function useOfflineFailure(error: unknown, retry: () => void, failedOffline = false) {
  const offline = failedOffline || isOfflineError(error);
  useOnReconnect(() => {
    if (offline) retry();
  });
  return offline;
}

export function OfflineNotice({
  onRetry,
  reason,
  headingLevel = 2,
}: {
  onRetry: () => void;
  reason?: 'online-only' | 'not-downloaded';
  headingLevel?: 1 | 2;
}) {
  const { t } = useTranslation();
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const title =
    reason === 'online-only'
      ? 'offline.page-title'
      : reason === 'not-downloaded'
        ? 'offline.unavailable-title'
        : 'offline.notice-title';

  return (
    <StatusPage>
      <EmptyHeader>
        <EmptyMedia size={headingLevel === 1 ? 'lg' : 'default'} variant="icon">
          <WifiOffIcon />
        </EmptyMedia>
        <EmptyTitle size={headingLevel === 1 ? 'lg' : 'default'}>
          <Heading tabIndex={headingLevel === 1 ? -1 : undefined}>{t(title)}</Heading>
        </EmptyTitle>
        <EmptyDescription size={headingLevel === 1 ? 'lg' : 'default'}>
          {reason === 'online-only' ? (
            <OnlinePageDescription />
          ) : (
            t(
              reason === 'not-downloaded'
                ? 'offline.unavailable-description'
                : 'offline.notice-description',
            )
          )}
        </EmptyDescription>
      </EmptyHeader>
      <Button
        onClick={() => {
          onRetry();
          if (!isOnline())
            toast.info(t('offline.title'), { description: t('offline.retry-unavailable') });
        }}
        size="lg"
        variant="outline"
      >
        <RotateCcwIcon data-icon="inline-start" />
        {t('error.try-again')}
      </Button>
    </StatusPage>
  );
}

function OnlinePageDescription() {
  const { t } = useTranslation();
  const canWorkOffline = useHasOfflineCapability();
  return t(canWorkOffline ? 'offline.page-description' : 'offline.page-description-generic');
}
