import {
  type DownloadStatus,
  getDownloadStatus,
  setDownloadStatus,
} from '@/lib/offline-download-status';
import { getSessionScope } from '@/lib/session-scope';

export function createDownloadChannel(isActive: () => boolean) {
  let channel: BroadcastChannel | undefined;
  let channelName: string | undefined;
  let watchedChannel: BroadcastChannel | undefined;
  let observedRunning = false;
  let observedCompletion = false;
  const close = () => {
    channel?.close();
    channel = undefined;
    channelName = undefined;
  };
  return {
    close,
    completed: () => observedCompletion,
    resetObservations() {
      observedCompletion = false;
      observedRunning = false;
    },
    observe: () => channel?.postMessage({ type: 'observe' }),
    publish(status: DownloadStatus) {
      setDownloadStatus(status);
      channel?.postMessage({ type: 'status', status });
    },
    connect(name: string) {
      if (channelName === name) return;
      close();
      channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(name);
      channelName = name;
      if (!channel) return;
      channel.onmessage = ({ data }) => {
        if (data?.type === 'status') {
          setDownloadStatus(data.status);
          if (data.status.phase === 'running') {
            observedRunning = true;
            if (watchedChannel !== channel && navigator.locks) {
              watchedChannel = channel;
              const scope = getSessionScope();
              const observedChannel = channel;
              void navigator.locks
                .request(name, { mode: 'shared' }, async () => {
                  // Completion messages may still be in flight after the lock is released.
                  await new Promise((resolve) => setTimeout(resolve, 25));
                  if (scope !== getSessionScope() || channel !== observedChannel) return;
                  const status = getDownloadStatus();
                  if (status.phase === 'running')
                    setDownloadStatus(
                      status.incomplete.length || status.accessFailed
                        ? { ...status, phase: 'failed', reason: 'read' }
                        : { phase: 'idle', incomplete: [] },
                    );
                })
                .catch(() => undefined)
                .finally(() => {
                  if (watchedChannel === observedChannel) watchedChannel = undefined;
                });
            }
          }
          if (
            observedRunning &&
            (data.status.phase === 'complete' || data.status.phase === 'failed')
          )
            observedCompletion = true;
        }
        if (data?.type === 'observe' && isActive() && getDownloadStatus().phase === 'running')
          channel?.postMessage({ type: 'status', status: getDownloadStatus() });
      };
    },
  };
}
