import { type ComponentProps, useState } from 'react';
import { ListError } from '@/components/list-error';
import { OfflineNotice, useOfflineFailure } from '@/components/offline-notice';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { isOnline } from '@/lib/online';

export function StockReadError(props: ComponentProps<typeof ListError>) {
  return props.error instanceof LocalDataUnavailableError ? (
    <MissingStockDownload error={props.error} reset={props.reset} />
  ) : (
    <ListError {...props} />
  );
}

function MissingStockDownload({ error, reset }: { error: Error; reset: () => void }) {
  const [failedOffline] = useState(() => !isOnline());
  useOfflineFailure(error, reset, failedOffline);
  return <OfflineNotice onRetry={reset} reason="not-downloaded" />;
}
