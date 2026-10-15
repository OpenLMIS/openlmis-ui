import { onlineManager, QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '@/components/command-palette';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { parsePermissions } from '@/lib/permissions';
import { renderPage } from '@/tests/render-page';

vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));
vi.mock('@/lib/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feature-flags')>();
  return {
    ...actual,
    useFlag: (key: string) => {
      const value = actual.useFlag(key as never);
      return key === 'SYSTEM_SETTINGS' || value;
    },
  };
});

function renderPalette(rights: string[], children?: ReactNode) {
  useLoginData.setState({ referenceDataUserId: 'u1', username: 'admin' });
  const queryClient = new QueryClient();
  queryClient.setQueryData(permissionsOptions('u1').queryKey, parsePermissions(rights));
  renderPage(
    <>
      <CommandPalette />
      {children}
    </>,
    { queryClient },
  );
}

function OtherDialog() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Unsaved form</DialogTitle>
        <DialogDescription>Keep this workflow active.</DialogDescription>
        <button type="button" onClick={() => setOpen(false)}>
          Finish
        </button>
      </DialogContent>
    </Dialog>
  );
}

afterEach(() => {
  cleanup();
  useLoginData.setState({ referenceDataUserId: null, username: null });
});

describe('CommandPalette', () => {
  it('ignores its shortcut during another dialog and still toggles its own palette', async () => {
    renderPalette([], <OtherDialog />);
    await screen.findByRole('dialog', { name: 'Unsaved form' });
    const shortcut = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    fireEvent(document, shortcut);
    expect(shortcut.defaultPrevented).toBe(true);
    expect(screen.queryByRole('option', { name: 'nav-user.account' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Unsaved form' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('option', { name: 'nav-user.account' })).toBeInTheDocument();
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('option', { name: 'nav-user.account' })).not.toBeInTheDocument();
  });
  it('opens over a nonmodal popover instead of treating it as a blocking modal', async () => {
    renderPalette(
      [],
      <Popover defaultOpen>
        <PopoverTrigger>Help</PopoverTrigger>
        <PopoverContent aria-label="Help content">Helpful information</PopoverContent>
      </Popover>,
    );
    expect(await screen.findByRole('dialog', { name: 'Help content' })).toBeInTheDocument();
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('option', { name: 'nav-user.account' })).toBeInTheDocument();
  });
  it('offers Account and, with the right, Settings', async () => {
    renderPalette(['SYSTEM_SETTINGS_MANAGE']);

    await userEvent.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('option', { name: 'nav-user.account' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'nav-user.settings' })).toBeInTheDocument();
  });

  it('leaves Settings out for someone without the right', async () => {
    renderPalette(['USERS_MANAGE']);

    await userEvent.keyboard('{Control>}k{/Control}');

    expect(await screen.findByRole('option', { name: 'nav-user.account' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'nav-user.settings' })).not.toBeInTheDocument();
  });
});

it('keeps offline server entries visible with an explanation and prevents selection', async () => {
  onlineManager.setOnline(false);
  renderPalette(['STOCK_ADJUST', 'USERS_MANAGE']);
  await userEvent.keyboard('{Control>}k{/Control}');
  const issue = await screen.findByRole('option', { name: /nav.stock-management.issue/ });
  expect(issue).toHaveAttribute('data-unavailable', 'true');
  expect(issue).toHaveTextContent('offline.connection-required');
  await userEvent.click(issue);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(
    screen.getByRole('option', { name: 'nav.stock-management.adjustments' }),
  ).not.toHaveAttribute('aria-disabled', 'true');
});

it('lets keyboard users reach an offline item and hear its reason without leaving the palette', async () => {
  onlineManager.setOnline(false);
  renderPalette(['STOCK_ADJUST']);
  await userEvent.keyboard('{Control>}k{/Control}');
  const input = await screen.findByRole('combobox');
  await userEvent.type(input, 'nav.stock-management.issue');
  await userEvent.keyboard('{ArrowDown}');
  const issue = screen.getByRole('option', { name: /nav.stock-management.issue/ });
  await waitFor(() => expect(issue).toHaveAttribute('data-selected', 'true'));
  await userEvent.keyboard('{Enter}');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(issue).toHaveAttribute('aria-describedby');
  expect(toast.info).toHaveBeenCalledWith('offline.connection-required');
});
