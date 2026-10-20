import { act, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useDeviceSync } from '@/components/device-work';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  announceQueuedEvents,
  setSyncPhase,
} from '@/features/stock-events/lib/device-event-status';
import { announceDeviceSave } from '@/features/stock-events/lib/device-save-announcement';
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
it('renders signed-in routes while the device-work chunk is still loading', async () => {
  login();
  render(
    <SignedInDeviceWork>
      <p>Routed content</p>
    </SignedInDeviceWork>,
  );
  try {
    expect(screen.getByText('Routed content')).toBeVisible();
    expect(screen.queryByTestId('device-work')).not.toBeInTheDocument();
  } finally {
    await act(async () => chunk.resolve());
  }
  expect(await screen.findByTestId('device-work')).toBeInTheDocument();
});

it('boots a restored session and forces downloads after logout and login', async () => {
  login();
  render(<SignedInDeviceWork>Content</SignedInDeviceWork>);
  expect(await screen.findByTestId('device-work')).toHaveAttribute('data-trigger', 'boot');
  act(() => useLoginData.getState().clearLoginData());
  expect(screen.queryByTestId('device-work')).not.toBeInTheDocument();
  act(login);
  expect(await screen.findByTestId('device-work')).toHaveAttribute('data-trigger', 'force');
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
