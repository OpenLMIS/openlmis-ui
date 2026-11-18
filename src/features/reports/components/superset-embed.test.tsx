import type { EmbedDashboardParams } from '@superset-ui/embedded-sdk';
import { onlineManager } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PageVisibility } from '@/components/shared/page-visibility';
import { fetchGuestToken } from '@/features/reports/api/api';
import { DashboardViewer } from '@/features/reports/components/dashboard-viewer';
import { HANDSHAKE_LIMIT_MS, TOKEN_LIMIT_MS } from '@/features/reports/components/superset-embed';
import type { DashboardReport } from '@/features/reports/lib/types';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { reportCaughtError } from '@/lib/report-error';
import { SessionEndedError } from '@/lib/session-scope';
import { httpError } from '@/test-utils/http-error';
import { renderPage } from '@/test-utils/render-page';

const sdk = vi.hoisted(() => ({
  embedDashboard: vi.fn(),
  loadError: undefined as Error | undefined,
}));
// Dev and production bundles both expose the CommonJS SDK only as a default export.
vi.mock('@superset-ui/embedded-sdk', () => ({
  get default() {
    if (sdk.loadError) throw sdk.loadError;
    return sdk;
  },
  embedDashboard: undefined,
}));
vi.mock('@/features/reports/api/api', () => ({ fetchGuestToken: vi.fn() }));
vi.mock('@/lib/report-error', () => ({ reportCaughtError: vi.fn() }));

const report: DashboardReport = {
  id: 'r1',
  name: 'Stock Dashboard',
  type: 'SUPERSET',
  embeddedUuid: '0d6f1b4e-3c1a-4c58-9a3f-2f1d6a6e7b10',
};

type Embedding = {
  params: EmbedDashboardParams;
  frame: HTMLIFrameElement;
  resolve: (handshake?: Promise<unknown>) => Handle;
  reject: () => void;
};
type Handle = { unmount: ReturnType<typeof vi.fn>; getScrollSize: ReturnType<typeof vi.fn> };

let embeddings: Embedding[] = [];
let setHidden: (hidden: boolean) => void = () => {};

beforeEach(() => {
  embeddings = [];
  sdk.loadError = undefined;
  sdk.embedDashboard.mockImplementation((params: EmbedDashboardParams) => {
    const { promise, resolve, reject } = Promise.withResolvers<Handle>();
    const frame = document.createElement('iframe');
    frame.title = params.iframeTitle ?? '';
    params.mountPoint.replaceChildren(frame);
    embeddings.push({
      params,
      frame,
      resolve: (handshake = Promise.resolve({ width: 1, height: 1 })) => {
        const handle = {
          unmount: vi.fn(() => params.mountPoint.replaceChildren()),
          getScrollSize: vi.fn(() => handshake),
        };
        resolve(handle);
        return handle;
      },
      reject: () => {
        params.mountPoint.replaceChildren();
        reject(new Error('Embedding failed'));
      },
    });
    return promise;
  });
  vi.mocked(fetchGuestToken).mockResolvedValue('guest');
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.removeItem('openlmis-ui:chunk-reload');
});

function Harness() {
  const [hidden, set] = useState(false);
  setHidden = set;
  return (
    <PageVisibility hidden={hidden}>
      <DashboardViewer report={report} supersetUrl="https://superset.example.org" userId="ada" />
    </PageVisibility>
  );
}

async function open() {
  renderPage(<Harness />);
  await screen.findByTitle('Stock Dashboard');
  return embeddings.at(-1) as Embedding;
}

const connect = async (embedding: Embedding, handshake?: Promise<unknown>) => {
  let handle: Handle | undefined;
  await act(async () => {
    handle = embedding.resolve(handshake);
  });
  return handle as Handle;
};

it('embeds through the bundled SDK with the legacy layout and connects on the handshake', async () => {
  const embedding = await open();
  expect(embedding.params).toMatchObject({
    id: report.embeddedUuid,
    supersetDomain: 'https://superset.example.org',
    iframeTitle: 'Stock Dashboard',
    dashboardUiConfig: {
      hideTitle: true,
      hideChartControls: false,
      hideTab: false,
      filters: { visible: true, expanded: false },
    },
  });
  expect(embedding.params).not.toHaveProperty('referrerPolicy');
  expect(screen.getByText('reports.dashboard.connecting')).toBeVisible();

  await connect(embedding);

  expect(screen.queryByText('reports.dashboard.connecting')).not.toBeInTheDocument();
  expect(screen.getByTitle('Stock Dashboard')).toBe(embedding.frame);
  expect(screen.getByRole('button', { name: 'error.try-again' })).toBeEnabled();
});

it('keeps a newer opening when an older one resolves or fails late', async () => {
  const first = await open();
  await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
  const second = embeddings[1];
  await connect(second);

  const late = await connect(first);
  expect(late.unmount).toHaveBeenCalledOnce();
  const third = embeddings.length;
  await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
  await act(async () => embeddings[third].reject());
  await act(async () => first.reject());

  expect(screen.getByRole('alert')).toHaveTextContent('reports.dashboard.did-not-load-title');
  expect(embeddings).toHaveLength(3);
});

it('unmounts a dashboard that resolves after the page has gone', async () => {
  const embedding = await open();
  cleanup();

  const late = await connect(embedding);

  expect(late.unmount).toHaveBeenCalledOnce();
  expect(embedding.params.mountPoint.isConnected).toBe(false);
});

it('maps a token-renewal failure and reports it without credentials', async () => {
  const embedding = await open();
  await connect(embedding);

  const failure = httpError(403);
  failure.config = {
    headers: { Authorization: 'synthetic-private-value' },
  } as typeof failure.config;
  vi.mocked(fetchGuestToken).mockRejectedValueOnce(failure);
  await act(() => expect(embedding.params.fetchGuestToken()).rejects.toThrow());

  expect(screen.getByRole('alert')).toHaveTextContent('reports.dashboard.refused-title');
  expect(reportCaughtError).toHaveBeenCalledWith(
    new Error('Dashboard failed: refused (HTTP 403)'),
    { componentStack: 'SupersetEmbed' },
  );
  expect(JSON.stringify(vi.mocked(reportCaughtError).mock.calls)).not.toContain(
    'synthetic-private-value',
  );
  expect(screen.queryByTitle('Stock Dashboard')).not.toBeInTheDocument();
});

it('shows Not Set Up when the reporting service has no Superset configured', async () => {
  const embedding = await open();
  vi.mocked(fetchGuestToken).mockRejectedValueOnce(
    httpError(500, { messageKey: 'report.error.superset.notConfigured' }),
  );

  await act(() => expect(embedding.params.fetchGuestToken()).rejects.toThrow());

  expect(screen.getByText('reports.dashboard.not-set-up-title')).toBeInTheDocument();
});

it('stops asking for tokens once the session has ended', async () => {
  const embedding = await open();
  vi.mocked(fetchGuestToken).mockRejectedValueOnce(new SessionEndedError());

  await act(() => expect(embedding.params.fetchGuestToken()).rejects.toThrow());
  await expect(embedding.params.fetchGuestToken()).rejects.toThrow();

  expect(fetchGuestToken).toHaveBeenCalledOnce();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('gives up on a token request after its deadline and offers Try Again', async () => {
  const embedding = await open();
  vi.useFakeTimers();
  vi.mocked(fetchGuestToken).mockImplementationOnce(
    (_uuid, _user, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  );

  const token = embedding.params.fetchGuestToken().catch((error: unknown) => error);
  await act(async () => vi.advanceTimersByTime(TOKEN_LIMIT_MS));

  expect(await token).toBeInstanceOf(Error);
  expect(vi.mocked(fetchGuestToken).mock.calls[0][2].aborted).toBe(true);
  expect(screen.getByRole('alert')).toHaveTextContent('reports.dashboard.unavailable-title');
});

it('shows Did Not Load when the frame never answers the handshake', async () => {
  const embedding = await open();
  vi.useFakeTimers();
  const handle = await connect(embedding, new Promise(() => {}));
  expect(screen.getByText('reports.dashboard.connecting')).toBeInTheDocument();

  await act(async () => vi.advanceTimersByTime(HANDSHAKE_LIMIT_MS));

  expect(screen.getByRole('alert')).toHaveTextContent('reports.dashboard.did-not-load-title');
  expect(handle.unmount).toHaveBeenCalledOnce();
});

it('ends the opening while the app is hidden and opens exactly once on return', async () => {
  const embedding = await open();
  const handle = await connect(embedding);

  act(() => setHidden(true));
  expect(handle.unmount).toHaveBeenCalledOnce();
  expect(screen.queryByTitle('Stock Dashboard')).not.toBeInTheDocument();

  act(() => setHidden(false));
  await screen.findByTitle('Stock Dashboard');
  expect(embeddings).toHaveLength(2);
});

it('uses guarded page recovery for a failed SDK module, including Try Again', async () => {
  sdk.loadError = new TypeError('Failed to fetch dynamically imported module: /assets/sdk-old.js');
  const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
  let proceed: () => void = () => {};
  const ask = vi.fn((next: () => void) => {
    proceed = next;
  });
  function Draft() {
    useLeaveGuard(true, ask);
    return <Harness />;
  }
  renderPage(<Draft />);

  expect(await screen.findByRole('heading', { name: 'error.title' })).toBeVisible();
  expect(ask).toHaveBeenCalledOnce();
  expect(reload).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'error.try-again' }));
  expect(ask).toHaveBeenCalledTimes(2);
  act(() => proceed());

  expect(reload).toHaveBeenCalledOnce();
  expect(sdk.embedDashboard).not.toHaveBeenCalled();
});

it('keeps a missing SDK unavailable offline and recovers when connection returns', async () => {
  sdk.loadError = new TypeError('Failed to fetch dynamically imported module: /assets/sdk-old.js');
  const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
  onlineManager.setOnline(false);
  renderPage(<Harness />);

  expect(await screen.findByRole('heading', { name: 'offline.unavailable-title' })).toBeVisible();
  expect(reload).not.toHaveBeenCalled();
  act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(reload).toHaveBeenCalledOnce());
});
