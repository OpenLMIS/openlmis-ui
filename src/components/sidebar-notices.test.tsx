import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '@/../public/locales/en.json';
import { OfflineDot, SidebarNotices, StatusAnnouncer } from '@/components/sidebar-notices';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UpdateButton } from '@/components/update-button';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  announceQueuedEvents,
  setSyncPhase,
  syncCountdown,
  useQueuedAnnouncement,
  useSyncPhase,
  wakeStockEventSync,
} from '@/features/stock-events/lib/device-event-status';
import { useDeviceSaveAnnouncement } from '@/features/stock-events/lib/device-save-announcement';
import { isPendingDeviceEvent } from '@/features/stock-events/lib/pending-device-event';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { allowUnload, useLeaveGuard } from '@/hooks/use-leave-guard';
import * as mobile from '@/hooks/use-mobile';
import { setDownloadStatus } from '@/lib/offline-download-status';
import { dismissBackOnline } from '@/lib/online';
import { applyUpdate } from '@/lib/service-worker';

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
}));
const device = vi.hoisted(() => ({ allowed: false, events: [] as DeviceEvent[] }));
vi.mock('@/components/nav-access', () => ({ useHasOfflineCapability: () => device.allowed }));
vi.mock('@/components/device-work', async (original) => ({
  ...(await original<typeof import('@/components/device-work')>()),
  useDeviceSync: () => ({
    phase: useSyncPhase(),
    queued: useQueuedAnnouncement(),
    save: useDeviceSaveAnnouncement(),
    countdown: syncCountdown,
    wake: wakeStockEventSync,
  }),
  useDeviceWork: () => ({
    hasDeviceEvents: device.events.length > 0,
    pending: device.events.filter(isPendingDeviceEvent).length,
    waiting: device.events.filter(
      (event) => !event.pauseReason && ['queued', 'sending'].includes(event.status),
    ).length,
    uncertain: device.events.filter((event) => event.status === 'uncertain').length,
    refused: device.events.filter((event) => event.status === 'refused' && !event.error?.resolvedAt)
      .length,
    sending: device.events.some((event) => event.status === 'sending'),
    retained: device.events.some((event) => event.status !== 'accepted'),
    pauses: ['access-changed', 'draft-changed'].filter((reason) =>
      device.events.some((event) => event.pauseReason === reason),
    ),
  }),
}));

const update = vi.hoisted(() => ({ ready: false, listeners: new Set<() => void>() }));
const setUpdateReady = (ready: boolean) => {
  update.ready = ready;
  for (const listener of update.listeners) listener();
};

vi.mock('@/lib/service-worker', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    applyUpdate: vi.fn(),
    useUpdateReady: () =>
      useSyncExternalStore(
        (onChange) => {
          update.listeners.add(onChange);
          return () => update.listeners.delete(onChange);
        },
        () => update.ready,
      ),
  };
});

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
        <UpdateButton />
        <StatusAnnouncer />
      </SidebarProvider>
    </TooltipProvider>,
  );

const showUpdate = () => act(() => setUpdateReady(true));

afterEach(() => {
  vi.useRealTimers();
  act(() => {
    onlineManager.setOnline(true);
    dismissBackOnline();
    setUpdateReady(false);
    setDownloadStatus({ phase: 'idle', incomplete: [] });
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
    const user = userEvent.setup();
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

    expect(
      screen.queryByRole('button', { name: 'update.reload-to-update' }),
    ).not.toBeInTheDocument();
    showUpdate();
    expect(screen.getByRole('status')).toHaveTextContent('update.reload-to-update');
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    act(() => setDownloadStatus({ phase: 'running', incomplete: [] }));
    expect(screen.getByRole('status')).not.toHaveTextContent('update.reload-to-update');
    await user.click(screen.getByRole('button', { name: 'update.reload-to-update' }));
    expect(applyUpdate).not.toHaveBeenCalled();

    act(() => proceed?.());
    expect(applyUpdate).toHaveBeenCalledExactlyOnceWith(allowUnload);
  });

  it('shrinks to icons on the collapsed rail, with connection retry and a separate update button', () => {
    onlineManager.setOnline(false);
    showUpdate();
    renderNotices({ defaultOpen: false });

    expect(screen.queryByText('offline.description')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    const retry = screen.getByRole('button', { name: 'notice.action-label' });
    expect(retry).toBeInTheDocument();
    expect(retry.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'update.reload-to-update' })).toBeInTheDocument();
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

it('replaces download progress with one completion notice for four seconds and retains failures', () => {
  vi.useFakeTimers();
  onlineManager.setOnline(false);
  renderNotices();
  expect(screen.getByRole('status')).toHaveTextContent('offline.title');
  act(() => setDownloadStatus({ phase: 'running', incomplete: [] }));
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.fetching');
  expect(screen.getByRole('status')).not.toHaveTextContent('offline.title');
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getAllByRole('note')).toHaveLength(2);
  expect(screen.getAllByRole('note').map((note) => note.textContent)).toEqual(
    expect.arrayContaining([expect.stringContaining('offline.download.fetching')]),
  );
  const progress = screen
    .getAllByRole('note')
    .find((note) => note.textContent?.includes('offline.download.fetching'));
  act(() => setDownloadStatus({ phase: 'complete', incomplete: [] }));
  expect(progress).toHaveTextContent('offline.download.finished');
  expect(screen.getByRole('status').textContent?.match(/offline.download.finished/g)).toHaveLength(
    1,
  );
  act(() => vi.advanceTimersByTime(3999));
  expect(progress).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(progress).not.toBeInTheDocument();
  act(() => setDownloadStatus({ phase: 'running', incomplete: [] }));
  act(() => setDownloadStatus({ phase: 'failed', incomplete: [], reason: 'timeout' }));
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.incomplete');
  expect(screen.queryByText('offline.download.finished')).not.toBeInTheDocument();
  act(() =>
    setDownloadStatus({
      phase: 'failed',
      incomplete: [
        {
          id: 'med',
          name: 'Medicines',
          dataset: 'home-stock',
          datasetLabel: 'offline.download.home-stock',
        },
      ],
      reason: 'timeout',
    }),
  );
  expect(screen.getAllByRole('note')).toHaveLength(2);
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.failed-programs');
  expect(screen.getByRole('status')).not.toHaveTextContent('offline.title');
  expect(screen.getByRole('button', { name: 'offline.download.retry' })).toBeInTheDocument();
});

it('suppresses an offline-caused download failure until reconnecting', () => {
  onlineManager.setOnline(false);
  setDownloadStatus({
    phase: 'failed',
    reason: 'offline',
    incomplete: [
      {
        id: 'p',
        name: 'Program',
        dataset: 'home-stock',
        datasetLabel: 'offline.download.home-stock',
      },
    ],
  });
  renderNotices();
  expect(screen.getAllByRole('note')).toHaveLength(1);
  expect(screen.queryByText('offline.download.incomplete')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).not.toHaveTextContent('offline.download.failure-offline');
  act(() => onlineManager.setOnline(true));
  expect(screen.getByRole('button', { name: 'offline.download.retry' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.failure-offline');
});

it('keeps accepted-event refresh progress and completion silent while retaining read failures', () => {
  renderNotices();
  for (const phase of ['running', 'complete'] as const) {
    act(() => setDownloadStatus({ phase, trigger: 'refresh', incomplete: [] }));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  }
  act(() =>
    setDownloadStatus({
      phase: 'failed',
      trigger: 'refresh',
      reason: 'read',
      incomplete: [],
    }),
  );
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.incomplete');
});

describe('OfflineDot', () => {
  it('marks the menu button while offline and the sidebar is closed', () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <OfflineDot />
      </SidebarProvider>,
    );
    expect(container.querySelector('[role=img]')).not.toBeInTheDocument();

    act(() => onlineManager.setOnline(false));

    expect(container.querySelector('[role=img]')).toBeInTheDocument();
  });

  it('stays away while the sidebar is open, since its own notice shows', () => {
    onlineManager.setOnline(false);
    const { container } = render(
      <SidebarProvider>
        <OfflineDot />
      </SidebarProvider>,
    );

    expect(container.querySelector('[role=img]')).not.toBeInTheDocument();
  });
});

it('clears the completed download announcement before later notices change', () => {
  vi.useFakeTimers();
  renderNotices();
  act(() => setDownloadStatus({ phase: 'complete', incomplete: [] }));
  expect(screen.getByRole('status')).toHaveTextContent('offline.download.finished');
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByRole('status')).not.toHaveTextContent('offline.download.finished');
  showUpdate();
  expect(screen.getByRole('status')).toHaveTextContent('update.reload-to-update');
  expect(screen.getByRole('status')).not.toHaveTextContent('offline.download.finished');
});

it('shows action-needed events once visibly and once in the persistent announcer', async () => {
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
  expect(screen.getByRole('status')).not.toHaveTextContent('Events Waiting To Sync');
  expect(
    screen.getByRole('status').textContent?.match(/2 Offline Events Need Review/g),
  ).toHaveLength(1);
  const notes = screen.getAllByRole('note');
  expect(notes).toHaveLength(3);
  expect(notes[0]).toHaveClass('border-destructive/30');
  expect(notes.some((note) => note.textContent?.includes('Access Changed'))).toBe(true);
  expect(screen.getAllByRole('button', { name: 'Review' })).toHaveLength(1);
  const needsReview = notes.find((note) =>
    note.textContent?.includes('2 Offline Events Need Review'),
  );
  expect(needsReview).toHaveClass('border-destructive/30');
  if (!needsReview) throw new Error('Missing action-needed notice');
  expect(within(needsReview).getByRole('button', { name: 'Review' })).toBeVisible();
  expect(screen.getAllByRole('status')).toHaveLength(1);
});
it('keeps the offline connection notice alone and offers sign-in after reconnect', () => {
  device.allowed = true;
  device.events = [{ status: 'queued' }] as DeviceEvent[];
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'adjuster', username: 'adjuster', accessToken: 'token' });
  useLoginData.getState().expireSession();
  onlineManager.setOnline(false);
  setSyncPhase('session');
  renderNotices();
  expect(screen.getAllByRole('note')).toHaveLength(1);
  expect(screen.getByRole('note')).toHaveTextContent('offline.title');
  expect(screen.getByRole('status')).not.toHaveTextContent('offline-events.sign-in');
  act(() => setSyncPhase('failed'));
  expect(screen.getAllByRole('note')).toHaveLength(1);
  expect(screen.getByRole('status')).not.toHaveTextContent('offline-events.sync-failed');
  act(() => onlineManager.setOnline(true));
  expect(
    screen
      .getAllByRole('note')
      .some((note) => note.textContent?.includes('offline-events.sign-in')),
  ).toBe(true);
  expect(screen.getByRole('status')).toHaveTextContent('offline-events.sign-in');
  const signIn = screen
    .getAllByRole('note')
    .find((note) => note.textContent?.includes('offline-events.sign-in'));
  expect(within(signIn as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'offline-events.review' })).not.toBeInTheDocument();
  act(() => useLoginData.getState().clearLoginData());
});

it('announces a user save with existing work, without announcing standing or falling counts', async () => {
  const language = createInstance();
  await language.use(ICU).init({
    lng: 'en',
    resources: { en: { translation: en } },
    keySeparator: false,
    nsSeparator: false,
  });
  vi.useFakeTimers();
  device.allowed = true;
  device.events = [{ status: 'queued' }, { status: 'queued' }] as DeviceEvent[];
  render(
    <I18nextProvider i18n={language}>
      <SidebarProvider>
        <StatusAnnouncer />
      </SidebarProvider>
    </I18nextProvider>,
  );
  const region = screen.getByRole('status');
  expect(region).toBeEmptyDOMElement();
  act(() => announceQueuedEvents(3));
  expect(region).toHaveTextContent('3 Events Waiting To Sync');
  act(() => vi.advanceTimersByTime(4000));
  expect(region).toBeEmptyDOMElement();
  device.events = [{ status: 'queued' }] as DeviceEvent[];
  act(() => setSyncPhase('syncing'));
  expect(region).not.toHaveTextContent('Waiting To Sync');
});

it('replaces sync progress with one completion notice for four seconds, without success on failure', () => {
  vi.useFakeTimers();
  device.allowed = true;
  device.events = [{ status: 'queued' }] as DeviceEvent[];
  setSyncPhase('syncing');
  renderNotices();
  const progress = screen.getByRole('note');
  expect(progress).toHaveTextContent('offline-events.syncing');
  device.events = [];
  act(() => setSyncPhase('complete'));
  expect(progress).toHaveTextContent('offline-events.sync-complete');
  expect(
    screen.getByRole('status').textContent?.match(/offline-events.sync-complete/g),
  ).toHaveLength(1);
  act(() => vi.advanceTimersByTime(3999));
  expect(progress).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(progress).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  device.events = [{ status: 'queued' }] as DeviceEvent[];
  act(() => setSyncPhase('syncing'));
  act(() => setSyncPhase('failed'));
  expect(screen.getByRole('note')).toHaveTextContent('offline-events.sync-failed');
  expect(screen.queryByText('offline-events.sync-complete')).not.toBeInTheDocument();
  device.events = [{ status: 'refused' }, { status: 'uncertain' }] as DeviceEvent[];
  act(() => setSyncPhase('complete'));
  expect(screen.queryByText('offline-events.sync-complete')).not.toBeInTheDocument();
});

it('pauses an auto-dismiss countdown while hovered or focused, then resumes the remaining lifetime', () => {
  vi.useFakeTimers();
  onlineManager.setOnline(false);
  renderNotices();
  act(() => onlineManager.setOnline(true));
  const notice = screen.getByRole('note');
  const close = within(notice).getByRole('button', { name: 'notice.close' });
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.mouseEnter(notice);
  act(() => vi.advanceTimersByTime(5000));
  expect(notice).toBeInTheDocument();
  fireEvent.focus(close);
  fireEvent.mouseLeave(notice);
  act(() => vi.advanceTimersByTime(5000));
  expect(notice).toBeInTheDocument();
  fireEvent.blur(close, { relatedTarget: document.body });
  act(() => vi.advanceTimersByTime(2999));
  expect(notice).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByText('offline.back-online')).not.toBeInTheDocument();
});

it('marks a closed sidebar for sync warnings and updates while online', () => {
  device.allowed = true;
  device.events = [{ status: 'queued', pauseReason: 'access-changed' }] as DeviceEvent[];
  renderNotices({ defaultOpen: false, extra: <OfflineDot /> });
  expect(screen.getByRole('img')).toHaveAccessibleName('offline-events.access-changed');
  device.events.push({ status: 'queued' } as DeviceEvent);
  act(() => setSyncPhase('session'));
  expect(screen.getByRole('img')).toHaveAccessibleName(/offline-events.sign-in/);
  showUpdate();
  expect(screen.getByRole('img')).toHaveAccessibleName(/update.reload-to-update/);
  expect(screen.getByRole('button', { name: 'offline-events.sign-in' }).tabIndex).toBe(0);
});

it('groups failed programs by dataset in separate messages', async () => {
  const language = createInstance();
  await language.use(ICU).init({
    lng: 'en',
    keySeparator: false,
    nsSeparator: false,
    resources: { en: { translation: en } },
  });
  setDownloadStatus({
    phase: 'failed',
    reason: 'read',
    incomplete: [
      { id: 'p1', name: 'Medicines', dataset: 'home-stock', datasetLabel: 'stock-on-hand.title' },
      { id: 'p2', name: 'Vaccines', dataset: 'home-stock', datasetLabel: 'stock-on-hand.title' },
      {
        id: 'p3',
        name: 'Supplies',
        dataset: 'adjustments',
        datasetLabel: 'nav.stock-management.adjustments',
      },
    ],
  });
  render(
    <I18nextProvider i18n={language}>
      <SidebarProvider>
        <SidebarNotices />
      </SidebarProvider>
    </I18nextProvider>,
  );
  expect(screen.getByRole('note').textContent).toContain(
    'Stock On Hand: Medicines, Vaccines\nAdjustments: Supplies',
  );
});

it.each(['refused', 'uncertain'] as const)(
  'marks the closed phone menu for %s work without requiring kind rights',
  (status) => {
    vi.spyOn(mobile, 'useIsMobile').mockReturnValue(true);
    device.events = [{ status }] as DeviceEvent[];
    renderNotices({ extra: <OfflineDot />, defaultOpen: false });
    expect(screen.getByRole('img', { name: 'offline-events.action-needed-count' })).toHaveClass(
      'bg-destructive',
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
  },
);
