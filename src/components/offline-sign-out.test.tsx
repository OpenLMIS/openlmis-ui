import { onlineManager } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineSignOut } from '@/components/offline-sign-out';
import { useLoginData } from '@/features/auth/store/login-data';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { getLocalDb } from '@/integrations/local-db';
import * as deviceWork from '@/lib/unsynced-device-work';
import { countUnsyncedDeviceWork } from '@/lib/unsynced-device-work';

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

    await waitFor(() => expect(onSignOut).toHaveBeenCalledOnce());
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

beforeEach(() =>
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'logout-user',
    username: 'logout-user',
    accessToken: 'token',
  }),
);
afterEach(async () => {
  await getLocalDb().delete();
  useLoginData.getState().clearLoginData();
});

it.each(['queued', 'sending', 'uncertain', 'held', 'refused', 'draft'])(
  'warns online about retained %s device work and never deletes it',
  async (state) => {
    const db = getLocalDb();
    const table =
      state === 'refused'
        ? 'stockEventSyncErrors'
        : state === 'draft'
          ? 'stockEventDrafts'
          : 'stockEventQueue';
    await db.table(table).put({
      localEventId: 'event',
      draftId: 'draft',
      userId: 'logout-user',
      state: 'editing',
      lines: [{}],
      status: state === 'held' ? 'queued' : state,
      pauseReason: state === 'held' ? 'access-changed' : undefined,
    });
    const onSignOut = vi.fn();
    render(<SignOutButton onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('sign-out-device.description');
    expect(onSignOut).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'sign-out-offline.confirm' }));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(await db.table(table).count()).toBe(1);
  },
);

it('flushes before counting and gives one combined offline warning', async () => {
  onlineManager.setOnline(false);
  function FlushDraft() {
    useLeaveGuard(true, (proceed) => {
      void getLocalDb()
        .table('stockEventDrafts')
        .put({ draftId: 'flushed', state: 'editing', lines: [{}] })
        .then(proceed);
    });
    return null;
  }
  const onSignOut = vi.fn();
  render(
    <>
      <FlushDraft />
      <SignOutButton onSignOut={onSignOut} />
    </>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('sign-out-device.description');
  expect(dialog).toHaveTextContent('sign-out-offline.description');
  expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'sign-out-offline.stay' }));
  expect(onSignOut).not.toHaveBeenCalled();
});

it('does not sign out a new identity after an old confirmation', async () => {
  onlineManager.setOnline(false);
  const onSignOut = vi.fn();
  render(<SignOutButton onSignOut={onSignOut} />);
  await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
  await screen.findByRole('alertdialog');
  act(() =>
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'other', username: 'other', accessToken: 'other' }),
  );
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(onSignOut).not.toHaveBeenCalled();
});

it('counts an uncertain event once across queue/errors and excludes resolved or accepted work', async () => {
  const db = getLocalDb();
  await db
    .table('stockEventQueue')
    .put({ localEventId: 'event', draftId: 'draft', status: 'uncertain' });
  await db.table('stockEventSyncErrors').put({ localEventId: 'event' });
  await db.table('stockEventDrafts').bulkPut([
    { draftId: 'draft', state: 'uncertain', lines: [{}] },
    { draftId: 'accepted', state: 'accepted', lines: [{}] },
  ]);
  expect(await countUnsyncedDeviceWork()).toBe(1);
  await db.table('stockEventQueue').clear();
  await db.table('stockEventSyncErrors').update('event', { resolvedAt: Date.now() });
  expect(await countUnsyncedDeviceWork()).toBe(0);
});

it.each(['failure', 'timeout'])(
  'allows confirmed sign-out after a device check %s',
  async (mode) => {
    const check = vi.spyOn(deviceWork, 'countUnsyncedDeviceWork');
    if (mode === 'failure') check.mockRejectedValue(new Error('Device unavailable'));
    else check.mockReturnValue(new Promise(() => {}));
    const onSignOut = vi.fn();
    render(<SignOutButton onSignOut={onSignOut} />);
    if (mode === 'timeout') {
      vi.useFakeTimers();
      act(() => screen.getByRole('button', { name: 'sign out' }).click());
      await act(() => vi.advanceTimersByTimeAsync(5000));
      vi.useRealTimers();
    } else await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'sign-out-device.check-failed',
    );
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName(
      'sign-out-device.check-failed-title',
    );
    expect(onSignOut).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'sign-out-offline.confirm' }));
    expect(onSignOut).toHaveBeenCalledOnce();
    check.mockRestore();
  },
);
