import { useEffect, useState } from 'react';
import {
  DashboardArea,
  DashboardFailureState,
  DashboardRecovery,
  FRAME_LOAD_LIMIT_MS,
} from '@/features/reports/components/dashboard-states';

/** The same isolation the Superset SDK gives embedded dashboards. */
const SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-presentation';

/** One opening of a linked dashboard; a load event only proves something answered. */
export function DashboardFrame({
  url,
  title,
  onRetry,
  restoreFocus,
}: {
  url: string;
  title: string;
  onRetry: () => void;
  restoreFocus: boolean;
}) {
  const [status, setStatus] = useState<'connecting' | 'loaded' | 'failed'>('connecting');
  useEffect(() => {
    const deadline = setTimeout(
      () => setStatus((current) => (current === 'connecting' ? 'failed' : current)),
      FRAME_LOAD_LIMIT_MS,
    );
    return () => clearTimeout(deadline);
  }, []);

  if (status === 'failed')
    return (
      <DashboardFailureState
        failure={{ kind: 'did-not-load' }}
        onRetry={onRetry}
        focus={restoreFocus}
      />
    );
  return (
    <DashboardArea
      connecting={status === 'connecting'}
      frame={
        <iframe
          src={url}
          title={title}
          sandbox={SANDBOX}
          allow="fullscreen; clipboard-write"
          className="size-full border-0"
          onLoad={() => setStatus('loaded')}
        />
      }
      recovery={<DashboardRecovery onRetry={onRetry} focus={restoreFocus} link={url} />}
    />
  );
}
