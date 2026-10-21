import { type ComponentProps, useState } from 'react';
import { LoadError } from '@/components/load-error';
import { NoAccess } from '@/components/no-access-page';
import { OfflineNotice, useOfflineFailure } from '@/components/offline-notice';
import { isForbidden } from '@/features/auth/lib/access';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { isOnline } from '@/lib/online';

export function ListError(props: ComponentProps<typeof LoadError>) {
  if (isForbidden(props.error)) return <NoAccess />;
  if (props.error instanceof LocalDataUnavailableError)
    return <MissingDownload error={props.error} reset={props.reset} />;
  return <LoadError {...props} />;
}

function MissingDownload({ error, reset }: { error: Error; reset: () => void }) {
  const [failedOffline] = useState(() => !isOnline());
  useOfflineFailure(error, reset, failedOffline);
  return <OfflineNotice onRetry={reset} reason="not-downloaded" />;
}
