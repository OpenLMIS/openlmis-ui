import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { OfflineDot, SidebarNotices, StatusAnnouncer } from '@/components/sidebar-notices';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLoginData } from '@/features/auth/store/login-data';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { allowUnload, useLeaveGuard } from '@/hooks/use-leave-guard';
import { setSyncPhase } from '@/lib/device-event-status';
import { setDownloadStatus } from '@/lib/offline-download-status';
import { dismissBackOnline } from '@/lib/online';
import { applyUpdate, dismissUpdate, registerServiceWorker } from '@/lib/service-worker';

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
}));
const device = vi.hoisted(() => ({ allowed: false, events: [] as DeviceEvent[] }));
vi.mock('@/components/nav-access', () => ({ useHasRight: () => device.allowed }));
vi.mock('@/features/stock-events/hooks/use-device-events', () => ({
  useDeviceEvents: () => ({ events: device.events }),
}));

const worker = vi.hoisted(() => ({ waiting: () => {} }));

vi.mock('workbox-window', () => ({
  Workbox: function Workbox() {
    return {
      addEventListener: (type: string, handler: () => void) => {
        if (type === 'waiting') worker.waiting = handler;
      },
      register: () => Promise.resolve(undefined),
    };
  },
}));
vi.mock('@/lib/service-worker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/service-worker')>()),
  applyUpdate: vi.fn(),
}));

function UnsavedDraft({ ask }: { ask: (proceed: () => void) => void }) {
  useLeaveGuard(true, ask);
  return null;
}

const renderNotices = ({ extra = null as React.ReactNode, defaultOpen = true } = {}) =>
  render(
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        {extra}
        <SidebarNotices />
        <StatusAnnouncer />
      </SidebarProvider>
    </TooltipProvider>,
  );

const showUpdate = () => act(() => worker.waiting());

beforeAll(() => {
  vi.stubGlobal('navigator', {
    ...navigator,
    serviceWorker: { controller: null, addEventListener: vi.fn() },
  });
  registerServiceWorker({ enabled: true });
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
  act(() => {
    onlineManager.setOnline(true);
    dismissBackOnline();
    dismissUpdate();
    setDownloadStatus({ phase: 'idle', failed: [] });
    setSyncPhase('idle');
    device.allowed = false;
    device.events = [];
  });
});

describe('SidebarNotices', () => {
  it('shows nothing while online and up to date', () => {
    renderNotices();

    expect(screen.queryByText('offline.title')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('says the app is offline for as long as it is, with no way to dismiss it', () => {
    onlineManager.setOnline(false);
    renderNotices();

    expect(screen.getAllByText('offline.title')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: /notice\.close/ })).not.toBeInTheDocument();

    act(() => onlineManager.setOnline(true));

    expect(screen.queryByText('offline.title')).not.toBeInTheDocument();
  });

  it('says the connection is back for a few seconds', () => {
    vi.useFakeTimers();
    onlineManager.setOnline(false);
    renderNotices();

    act(() => onlineManager.setOnline(true));
    expect(screen.getAllByText('offline.back-online')).not.toHaveLength(0);

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('offline.back-online')).not.toBeInTheDocument();
  });

  it('lets the user dismiss the back online notice, named for what it closes', async () => {
    onlineManager.setOnline(false);
    renderNotices();
    act(() => onlineManager.setOnline(true));

    await userEvent.click(screen.getByRole('button', { name: 'notice.close' }));

    expect(screen.queryByText('offline.back-online')).not.toBeInTheDocument();
  });

  it('offers a new version, and asks about unsaved changes before reloading into it', async () => {
    showUpdate();
    let proceed: (() => void) | undefined;
    renderNotices({
      extra: (
        <UnsavedDraft
          ask={(next) => {
            proceed = next;
          }}
        />
      ),
    });

    await userEvent.click(screen.getByRole('button', { name: 'update.reload' }));
    expect(applyUpdate).not.toHaveBeenCalled();

    act(() => proceed?.());
    expect(applyUpdate).toHaveBeenCalledExactlyOnceWith(allowUnload);
  });

  it('hides the update notice when dismissed', async () => {
    showUpdate();
    renderNotices();
    expect(screen.getAllByText('update.title')).not.toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'notice.close' }));

    expect(screen.queryByText('update.title')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('shrinks to icons on the collapsed rail, with connection retry and update actions', () => {
    onlineManager.setOnline(false);
    showUpdate();
    renderNotices({ defaultOpen: false });

    expect(screen.queryByText('offline.description')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'error.try-again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'update.reload' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});

describe('StatusAnnouncer', () => {
  it('stays on the page and says each change, so a screen reader hears it', () => {
    renderNotices();
    const region = screen.getByRole('status');

    act(() => onlineManager.setOnline(false));
    expect(region).toHaveTextContent('offline.title');

    act(() => onlineManager.setOnline(true));
    expect(region).toHaveTextContent('offline.back-online');
  });
});

it('keeps concurrent warning notes separate and announces download start, finish and failure once', () => {
  renderNotices();
  act(() => setDownloadStatus({ phase: 'running', failed: [] }));
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.fetching');
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('note')).toHaveTextContent('offline.download.fetching');
  act(() => setDownloadStatus({ phase: 'complete', failed: [] }));
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.finished');
  act(() => {
    onlineManager.setOnline(false);
    setDownloadStatus({
      phase: 'failed',
      failed: [{ id: 'med', name: 'Medicines' }],
      reason: 'timeout',
    });
  });
  expect(screen.getAllByRole('note')).toHaveLength(2);
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.failed-programs');
  expect(screen.getByRole('button', { name: 'offline.download.retry' })).toBeInTheDocument();
});

describe('OfflineDot', () => {
  it('marks the menu button while offline and the sidebar is closed', () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <OfflineDot />
      </SidebarProvider>,
    );
    expect(container.querySelector('[aria-hidden=true]')).not.toBeInTheDocument();

    act(() => onlineManager.setOnline(false));

    expect(container.querySelector('[aria-hidden=true]')).toBeInTheDocument();
  });

  it('stays away while the sidebar is open, since its own notice shows', () => {
    onlineManager.setOnline(false);
    const { container } = render(
      <SidebarProvider>
        <OfflineDot />
      </SidebarProvider>,
    );

    expect(container.querySelector('[aria-hidden=true]')).not.toBeInTheDocument();
  });
});

it('clears the completed download announcement before later notices change', () => {
  vi.useFakeTimers();
  renderNotices();
  act(() => setDownloadStatus({ phase: 'complete', failed: [] }));
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.finished');
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByRole('status')).not.toHaveTextContent('offline.download.finished');
  showUpdate();
  expect(screen.getByRole('status')).toHaveTextContent('update.title');
  expect(screen.getByRole('status')).not.toHaveTextContent('offline.download.finished');
});

it('announces only the changed notice while concurrent warnings stay visible', () => {
  onlineManager.setOnline(false);
  renderNotices();
  expect(screen.getByRole('status')).toHaveTextContent('offline.title');
  act(() => setDownloadStatus({ phase: 'running', failed: [] }));
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.fetching');
  expect(screen.getByRole('status')).not.toHaveTextContent('offline.title');
  expect(screen.getAllByRole('note')).toHaveLength(2);
  act(() => setDownloadStatus({ phase: 'failed', failed: [], reason: 'timeout' }));
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.incomplete');
  expect(screen.getByRole('status')).not.toHaveTextContent('offline.title');
});

it('uncertain events stay out of Waiting To Sync and stacked notices offer review once', async () => {
  device.allowed = true;
  device.events = [
    { status: 'queued' },
    { status: 'sending' },
    { status: 'queued', pauseReason: 'access-changed' },
    { status: 'uncertain' },
    { status: 'refused' },
  ] as DeviceEvent[];
  const language = createInstance();
  await language.use(ICU).init({
    lng: 'en',
    resources: { en: { translation: en } },
    keySeparator: false,
    nsSeparator: false,
  });
  render(
    <I18nextProvider i18n={language}>
      <TooltipProvider>
        <SidebarProvider>
          <SidebarNotices />
          <StatusAnnouncer />
        </SidebarProvider>
      </TooltipProvider>
    </I18nextProvider>,
  );
  expect(screen.getByText('2 Events Waiting To Sync')).toBeVisible();
  expect(screen.getAllByRole('button', { name: 'Review Device Events' })).toHaveLength(1);
  expect(
    screen.getByRole('button', { name: 'Review Device Events' }).closest('[role="note"]'),
  ).toHaveTextContent('1 Event Needs Review');
  device.events = [{ status: 'uncertain' }] as DeviceEvent[];
  act(() => setSyncPhase('failed'));
  expect(screen.queryByText(/Waiting To Sync/)).not.toBeInTheDocument();
  expect(screen.getByText('1 Event Needs Review')).toBeVisible();
});
it('Sign In To Sync has no review action of its own', () => {
  device.allowed = true;
  device.events = [{ status: 'queued' }] as DeviceEvent[];
  setSyncPhase('session');
  renderNotices();
  const notice = screen
    .getAllByRole('note')
    .find((note) => note.textContent?.includes('device-events.sign-in'));
  expect(notice).toBeDefined();
  expect(notice?.querySelector('button')).toBeNull();
  expect(screen.getAllByRole('button', { name: 'device-events.review' })).toHaveLength(1);
});

it.each([false, true])(
  'only offers offline renewal for Adjustments access or pending work (access=%s)',
  (allowed) => {
    device.allowed = allowed;
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'admin',
      username: 'admin',
      accessToken: 'token',
      expiresIn: 30,
    });
    onlineManager.setOnline(false);
    renderNotices();
    expect(screen.queryByText('session.offline-description') !== null).toBe(allowed);
    useLoginData.getState().clearLoginData();
  },
);

it('does not describe a connected expired session as offline', () => {
  device.allowed = true;
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'adjuster', username: 'adjuster', accessToken: 'token' });
  useLoginData.getState().expireSession();
  renderNotices();
  expect(screen.queryByText('session.offline-description')).not.toBeInTheDocument();
  useLoginData.getState().clearLoginData();
});
