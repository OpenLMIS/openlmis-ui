import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineDot, SidebarNotices, StatusAnnouncer } from '@/components/sidebar-notices';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { applyUpdate, dismissUpdate, useUpdateReady } from '@/lib/service-worker';

vi.mock('@/lib/service-worker', () => ({
  useUpdateReady: vi.fn(() => false),
  applyUpdate: vi.fn(),
  dismissUpdate: vi.fn(),
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

beforeEach(() => vi.mocked(useUpdateReady).mockReturnValue(false));

afterEach(() => vi.useRealTimers());

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
    vi.mocked(useUpdateReady).mockReturnValue(true);
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
    expect(applyUpdate).toHaveBeenCalledOnce();
  });

  it('hides the update notice when dismissed', async () => {
    vi.mocked(useUpdateReady).mockReturnValue(true);
    renderNotices();

    await userEvent.click(screen.getByRole('button', { name: 'notice.close' }));

    expect(dismissUpdate).toHaveBeenCalledOnce();
  });

  it('shrinks to icons on the collapsed rail, with only the update one to press', () => {
    onlineManager.setOnline(false);
    vi.mocked(useUpdateReady).mockReturnValue(true);
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
