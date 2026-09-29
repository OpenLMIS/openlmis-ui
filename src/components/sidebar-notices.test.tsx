import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineDot, SidebarNotices } from '@/components/sidebar-notices';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLeaveGuard } from '@/hooks/use-leave-guard';

const updateServiceWorker = vi.fn();
let needRefresh = false;
const setNeedRefresh = vi.fn((value: boolean) => {
  needRefresh = value;
});

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

function UnsavedDraft({ ask }: { ask: (proceed: () => void) => void }) {
  useLeaveGuard(true, ask);
  return null;
}

const renderNotices = (extra?: React.ReactNode) =>
  render(
    <TooltipProvider>
      <SidebarProvider>
        {extra}
        <SidebarNotices />
      </SidebarProvider>
    </TooltipProvider>,
  );

beforeEach(() => {
  needRefresh = false;
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe('SidebarNotices', () => {
  it('shows nothing while online and up to date', () => {
    renderNotices();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says the app is offline for as long as it is, with no way to dismiss it', () => {
    onlineManager.setOnline(false);
    renderNotices();

    expect(screen.getByRole('status')).toHaveTextContent('offline.title');
    expect(screen.queryByRole('button', { name: 'notice.close' })).not.toBeInTheDocument();

    act(() => onlineManager.setOnline(true));

    expect(screen.queryByText('offline.title')).not.toBeInTheDocument();
  });

  it('says the connection is back for a few seconds', () => {
    vi.useFakeTimers();
    onlineManager.setOnline(false);
    renderNotices();

    act(() => onlineManager.setOnline(true));
    expect(screen.getByRole('status')).toHaveTextContent('offline.back-online');

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('offline.back-online')).not.toBeInTheDocument();
  });

  it('lets the user dismiss the back online notice', async () => {
    onlineManager.setOnline(false);
    renderNotices();
    act(() => onlineManager.setOnline(true));

    await userEvent.click(screen.getByRole('button', { name: 'notice.close' }));

    expect(screen.queryByText('offline.back-online')).not.toBeInTheDocument();
  });

  it('offers a new version, and asks about unsaved changes before reloading into it', async () => {
    needRefresh = true;
    let proceed: (() => void) | undefined;
    renderNotices(
      <UnsavedDraft
        ask={(next) => {
          proceed = next;
        }}
      />,
    );

    expect(screen.getByText('update.title')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'update.reload' }));
    expect(updateServiceWorker).not.toHaveBeenCalled();

    act(() => proceed?.());
    expect(updateServiceWorker).toHaveBeenCalledOnce();
  });

  it('hides the update notice when dismissed', async () => {
    needRefresh = true;
    renderNotices();

    await userEvent.click(screen.getByRole('button', { name: 'notice.close' }));

    expect(setNeedRefresh).toHaveBeenCalledWith(false);
  });
});

describe('OfflineDot', () => {
  it('marks the menu button while offline, for when the sidebar is out of view', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <OfflineDot />
      </SidebarProvider>,
    );
    expect(screen.queryByText('offline.title')).not.toBeInTheDocument();

    act(() => onlineManager.setOnline(false));

    expect(screen.getByText('offline.title')).toBeInTheDocument();
  });

  it('stays away while the sidebar is open, since its own notice shows', () => {
    onlineManager.setOnline(false);
    render(
      <SidebarProvider>
        <OfflineDot />
      </SidebarProvider>,
    );

    expect(screen.queryByText('offline.title')).not.toBeInTheDocument();
  });
});
