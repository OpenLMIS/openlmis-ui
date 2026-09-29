import { onlineManager } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useOfflineSignOut } from '@/components/offline-sign-out';

function SignOutButton({
  onSignOut,
  knownOffline,
}: {
  onSignOut: () => void;
  knownOffline?: boolean;
}) {
  const { confirm, dialog } = useOfflineSignOut();
  return (
    <>
      <button onClick={() => confirm(onSignOut, knownOffline)} type="button">
        sign out
      </button>
      {dialog}
    </>
  );
}

const goOffline = () => onlineManager.setOnline(false);

describe('useOfflineSignOut', () => {
  it('signs out at once while online', async () => {
    const onSignOut = vi.fn();
    render(<SignOutButton onSignOut={onSignOut} />);

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));

    expect(onSignOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('warns first while offline, since signing in again needs the network', async () => {
    goOffline();
    const onSignOut = vi.fn();
    render(<SignOutButton onSignOut={onSignOut} />);

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('sign-out-offline.title');
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('stays signed in when the user thinks better of it', async () => {
    goOffline();
    const onSignOut = vi.fn();
    render(<SignOutButton onSignOut={onSignOut} />);

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
    await userEvent.click(await screen.findByRole('button', { name: 'sign-out-offline.stay' }));

    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('signs out once the user confirms', async () => {
    goOffline();
    const onSignOut = vi.fn();
    render(<SignOutButton onSignOut={onSignOut} />);

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
    await userEvent.click(await screen.findByRole('button', { name: 'sign-out-offline.confirm' }));

    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('warns when the server was just out of reach, whatever the browser believes', async () => {
    const onSignOut = vi.fn();
    render(<SignOutButton knownOffline onSignOut={onSignOut} />);

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(onSignOut).not.toHaveBeenCalled();
  });
});
