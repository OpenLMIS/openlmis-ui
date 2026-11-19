import type { EmbeddedDashboard } from '@superset-ui/embedded-sdk';
import { CanceledError, isAxiosError, isCancel } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { fetchGuestToken } from '@/features/reports/api/api';
import {
  DashboardArea,
  type DashboardFailure,
  DashboardFailureState,
  DashboardRecovery,
  FRAME_LOAD_LIMIT_MS,
  tokenFailure,
} from '@/features/reports/components/dashboard-states';
import { isChunkLoadError } from '@/lib/chunk-load';
import { isOnline } from '@/lib/online';
import { reportCaughtError } from '@/lib/report-error';
import { SessionEndedError } from '@/lib/session-scope';

/** Below the SDK's own 30-second limit, so a slow token request fails visibly here first. */
export const TOKEN_LIMIT_MS = 25_000;
/** A reply proves only that the frame and its message channel work, not that charts loaded. */
export const HANDSHAKE_LIMIT_MS = 20_000;

const LEGACY_UI_CONFIG = {
  hideTitle: true,
  hideChartControls: false,
  hideTab: false,
  filters: { visible: true, expanded: false },
};

type EmbedDashboard = typeof import('@superset-ui/embedded-sdk').embedDashboard;

/** The SDK ships CommonJS, which the dev server exposes only as a default export. */
function sdkEmbed(sdk: { embedDashboard?: EmbedDashboard; default?: unknown }) {
  const embed =
    sdk.embedDashboard ??
    (sdk.default as { embedDashboard?: EmbedDashboard } | undefined)?.embedDashboard;
  if (!embed) throw new Error('The Superset SDK has no embedDashboard');
  return embed;
}

type Status =
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'chunk-failed'; error: Error }
  | { kind: 'failed'; failure: DashboardFailure };

/** One opening of an embedded Superset dashboard; Try Again and returning to the page remount it. */
export function SupersetEmbed({
  uuid,
  supersetUrl,
  title,
  userId,
  onRetry,
  restoreFocus,
}: {
  uuid: string;
  supersetUrl: string;
  title: string;
  userId: string;
  onRetry: () => void;
  restoreFocus: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'connecting' });

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const node = document.createElement('div');
    node.className = 'size-full *:size-full *:border-0';
    container.replaceChildren(node);

    let disposed = false;
    let handle: EmbeddedDashboard | undefined;
    let tokenAbort: AbortController | undefined;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (ms: number, run: () => void) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        run();
      }, ms);
      timers.add(timer);
      return timer;
    };
    const stop = (timer: ReturnType<typeof setTimeout>) => {
      clearTimeout(timer);
      timers.delete(timer);
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      tokenAbort?.abort();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      handle?.unmount();
      node.remove();
    };
    const fail = (failure: DashboardFailure) => {
      if (disposed) return;
      dispose();
      if (failure.kind !== 'offline') {
        const status = isAxiosError(failure.error) ? failure.error.response?.status : undefined;
        const detail = typeof status === 'number' ? ` (HTTP ${status})` : '';
        reportCaughtError(new Error(`Dashboard failed: ${failure.kind}${detail}`), {
          componentStack: 'SupersetEmbed',
        });
      }
      setStatus({ kind: 'failed', failure });
    };

    const fetchToken = () => {
      if (disposed) return Promise.reject(new CanceledError());
      const controller = new AbortController();
      tokenAbort = controller;
      let timedOut = false;
      const deadline = later(TOKEN_LIMIT_MS, () => {
        timedOut = true;
        controller.abort();
      });
      return fetchGuestToken(uuid, userId, controller.signal)
        .catch((error: unknown) => {
          if (error instanceof SessionEndedError) dispose();
          else if (timedOut) fail({ kind: 'unavailable' });
          else if (!isCancel(error)) fail(tokenFailure(error));
          throw error;
        })
        .finally(() => {
          stop(deadline);
          if (tokenAbort === controller) tokenAbort = undefined;
        });
    };

    const mountDeadline = later(FRAME_LOAD_LIMIT_MS, () => fail({ kind: 'did-not-load' }));
    void (async () => {
      let embedDashboard: EmbedDashboard;
      try {
        embedDashboard = sdkEmbed(await import('@superset-ui/embedded-sdk'));
      } catch (error) {
        if (disposed) return;
        if (error instanceof Error && isChunkLoadError(error)) {
          dispose();
          if (isOnline())
            reportCaughtError(new Error('Dashboard SDK chunk could not be loaded'), {
              componentStack: 'SupersetEmbed',
            });
          setStatus({ kind: 'chunk-failed', error });
          return;
        }
        fail({ kind: isOnline() ? 'did-not-load' : 'offline' });
        return;
      }
      if (disposed) return;
      let dashboard: EmbeddedDashboard;
      try {
        dashboard = await embedDashboard({
          id: uuid,
          supersetDomain: supersetUrl,
          mountPoint: node,
          fetchGuestToken: fetchToken,
          iframeTitle: title,
          dashboardUiConfig: LEGACY_UI_CONFIG,
        });
      } catch {
        fail({ kind: 'did-not-load' });
        return;
      }
      if (disposed) {
        dashboard.unmount();
        return;
      }
      handle = dashboard;
      stop(mountDeadline);
      const handshake = later(HANDSHAKE_LIMIT_MS, () => fail({ kind: 'did-not-load' }));
      dashboard.getScrollSize().then(
        () => {
          if (disposed) return;
          stop(handshake);
          setStatus({ kind: 'connected' });
        },
        () => fail({ kind: 'did-not-load' }),
      );
    })();
    return dispose;
  }, [uuid, supersetUrl, title, userId]);

  if (status.kind === 'chunk-failed')
    return <ErrorFallback error={status.error} info={undefined} reset={onRetry} />;
  if (status.kind === 'failed')
    return (
      <DashboardFailureState failure={status.failure} onRetry={onRetry} focus={restoreFocus} />
    );
  return (
    <DashboardArea
      connecting={status.kind === 'connecting'}
      frame={<div ref={host} className="size-full" />}
      recovery={<DashboardRecovery onRetry={onRetry} focus={restoreFocus} />}
    />
  );
}
