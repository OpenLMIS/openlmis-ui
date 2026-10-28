import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useDeviceSync } from '@/components/device-work';
import { useOfflineSignOut } from '@/components/offline-sign-out';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  announceQueuedEvents,
  setSyncPhase,
} from '@/features/stock-events/lib/device-event-status';
import { announceDeviceSave } from '@/features/stock-events/lib/device-save-announcement';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';
import { SignedInDeviceWork } from '@/routes/__root';

const chunk = vi.hoisted(() => Promise.withResolvers<void>());
vi.mock('@/routes/-device-work-provider', async () => {
  await chunk.promise;
  const { DeviceStatusProvider } = await import('@/routes/-device-status-provider');
  return {
    DeviceWorkProvider: ({ initialTrigger }: { initialTrigger: string }) => (
      <>
        <div data-testid="device-work" data-trigger={initialTrigger} />
        <DeviceStatusProvider />
      </>
    ),
  };
});

const login = () =>
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'device-work',
    username: 'Ada',
    accessToken: 'token',
  });
beforeEach(() => useLoginData.getState().clearLoginData());
it('signs out using owned work while the device-work chunk is still loading', async () => {
  login();
  const onSignOut = vi.fn();
  function SignOut() {
    const { confirm, dialog } = useOfflineSignOut();
    return (
      <>
        <button type="button" onClick={() => confirm(onSignOut)}>
          Log Out
        </button>
        {dialog}
      </>
    );
  }
  const db = getLocalDb();
  await db.table(LOCAL_TABLES.stockEventQueue).put({ localEventId: 'retained' });
  act(() =>
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'other-device-owner',
      username: 'Other',
      accessToken: 'other',
    }),
  );
  render(
    <SignedInDeviceWork>
      <p>Routed content</p>
      <SignOut />
    </SignedInDeviceWork>,
  );
  try {
    expect(screen.getByText('Routed content')).toBeVisible();
    expect(screen.queryByTestId('device-work')).not.toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'Log Out' }).click());
    await waitFor(() => expect(onSignOut).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('device-work')).not.toBeInTheDocument();
    await getLocalDb().delete();
    act(login);
    act(() => screen.getByRole('button', { name: 'Log Out' }).click());
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('sign-out-device.description');
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(await getLocalDb().table(LOCAL_TABLES.stockEventQueue).count()).toBe(1);
  } finally {
    await act(async () => chunk.resolve());
  }
  expect(await screen.findByTestId('device-work')).toBeInTheDocument();
  await getLocalDb().delete();
});

it('boots a restored session and forces downloads after logout and login', async () => {
  login();
  render(<SignedInDeviceWork>Content</SignedInDeviceWork>);
  expect(await screen.findByTestId('device-work')).toHaveAttribute('data-trigger', 'boot');
  act(() => useLoginData.getState().clearLoginData());
  expect(screen.queryByTestId('device-work')).not.toBeInTheDocument();
  act(login);
  expect(await screen.findByTestId('device-work')).toHaveAttribute('data-trigger', 'sign-in');
});

it('keeps routed children mounted and visible while signing in', async () => {
  const mounted = vi.fn();
  function Child() {
    const [value, setValue] = useState(0);
    useEffect(() => {
      mounted();
    }, []);
    return (
      <button type="button" onClick={() => setValue(value + 1)}>
        Count {value}
      </button>
    );
  }
  render(
    <SignedInDeviceWork>
      <Child />
    </SignedInDeviceWork>,
  );
  act(() => screen.getByRole('button', { name: 'Count 0' }).click());
  act(login);
  expect(screen.getByRole('button', { name: 'Count 1' })).toBeVisible();
  await screen.findByTestId('device-work');
  expect(screen.getByRole('button', { name: 'Count 1' })).toBeVisible();
  expect(mounted).toHaveBeenCalledOnce();
});

it('publishes sync and save status from sibling services and clears it after logout', async () => {
  function Status() {
    const { phase, queued, save } = useDeviceSync();
    return <p>{`${phase}/${queued?.count ?? 0}/${save ?? ''}`}</p>;
  }
  login();
  render(
    <SignedInDeviceWork>
      <Status />
    </SignedInDeviceWork>,
  );
  await screen.findByTestId('device-work');
  act(() => {
    setSyncPhase('syncing');
    announceQueuedEvents(2);
    announceDeviceSave('stock-events.draft-saved');
  });
  expect(screen.getByText('syncing/2/stock-events.draft-saved')).toBeVisible();
  act(() => useLoginData.getState().clearLoginData());
  expect(screen.getByText('idle/0/')).toBeVisible();
});

it('warns before logout when a requisition has unsynced device edits', async () => {
  login();
  const onSignOut = vi.fn();
  function SignOut() {
    const { confirm, dialog } = useOfflineSignOut();
    return (
      <>
        <button type="button" onClick={() => confirm(onSignOut)}>
          Log Out
        </button>
        {dialog}
      </>
    );
  }
  const db = getLocalDb();
  await db.table(LOCAL_TABLES.requisitionDrafts).put({
    draftId: 'requisition',
    userId: 'device-work',
    formatVersion: 1,
    modifiedDate: '2026-10-28T10:00:00Z',
    eTag: '"base"',
    draft: {
      lines: { line: { requestedQuantity: '12' } },
      addedLines: [],
      removedLineIds: [],
      draftStatusMessage: '',
      datePhysicalStockCountCompleted: null,
    },
  });
  render(
    <SignedInDeviceWork>
      <SignOut />
    </SignedInDeviceWork>,
  );
  act(() => screen.getByRole('button', { name: 'Log Out' }).click());
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('sign-out-device.description');
  expect(onSignOut).not.toHaveBeenCalled();
  expect(await db.table(LOCAL_TABLES.requisitionDrafts).count()).toBe(1);
  await db.delete();
});
