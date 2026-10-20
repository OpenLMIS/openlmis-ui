import type { DownloadStatus } from '@/lib/offline-download-status';

export function downloadDecision({
  trigger,
  requested,
  failed,
  accessFailed,
  changed,
  fresh,
  retryAt,
  now,
}: {
  trigger: NonNullable<DownloadStatus['trigger']>;
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
  if (changed || (!requested && (trigger === 'boot' || trigger === 'access') && fresh))
    return 'reuse';
  return 'fetch';
}
