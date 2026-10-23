import type { DownloadRefreshTrigger } from '@/lib/download-provider';
import type { DownloadStatus } from '@/lib/offline-download-status';

export function downloadDecision({
  trigger,
  periodic,
  refreshOn,
  complete,
  requested,
  failed,
  accessFailed,
  changed,
  fresh,
  retryAt,
  now,
}: {
  trigger: NonNullable<DownloadStatus['trigger']>;
  periodic: boolean;
  refreshOn: readonly DownloadRefreshTrigger[];
  complete: boolean;
  requested: boolean;
  failed: boolean;
  accessFailed: boolean;
  changed: boolean;
  fresh: boolean;
  retryAt: number;
  now: number;
}): 'defer' | 'skip' | 'reuse' | 'fetch' {
  if (retryAt > now) return 'defer';
  if (trigger === 'refresh' && !requested) return 'skip';
  if (!requested && trigger === 'retry' && !failed && !accessFailed) return 'skip';
  if (changed && !failed) return 'reuse';
  if (failed) return 'fetch';
  const cause =
    trigger === 'sign-in' || trigger === 'force'
      ? trigger
      : trigger === 'boot' && periodic
        ? 'periodic'
        : null;
  if (!requested && cause && !refreshOn.includes(cause) && complete) return 'reuse';
  if (!requested && (trigger === 'boot' || trigger === 'access') && fresh) return 'reuse';
  return 'fetch';
}
