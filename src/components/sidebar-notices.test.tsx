import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { OfflineDot, SidebarNotices, StatusAnnouncer } from '@/components/sidebar-notices';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { allowUnload, useLeaveGuard } from '@/hooks/use-leave-guard';
import { dismissBackOnline } from '@/lib/online';
import { applyUpdate, dismissUpdate, registerServiceWorker } from '@/lib/service-worker';

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

  it('shrinks to icons on the collapsed rail, with only the update one to press', () => {
    onlineManager.setOnline(false);
    showUpdate();
    renderNotices({ defaultOpen: false });

    expect(screen.queryByText('offline.description')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
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
