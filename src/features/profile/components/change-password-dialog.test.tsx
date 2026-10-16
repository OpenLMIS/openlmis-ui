import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { changePassword } from '@/features/profile/api/api';
import { ChangePasswordDialog } from '@/features/profile/components/change-password-dialog';
import * as deviceWork from '@/features/stock-events/lib/unsynced-device-work';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import type { UserRecord } from '@/lib/user-types';

beforeEach(() =>
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'u1', username: 'ada', accessToken: 'token' }),
);

vi.mock('@/components/device-work', () => ({
  useDeviceWork: () => ({ countUnsyncedWork: () => deviceWork.countUnsyncedDeviceWork() }),
}));

vi.mock('@/features/profile/api/api', () => ({ changePassword: vi.fn() }));

const user: UserRecord = {
  id: 'u1',
  username: 'ada',
  firstName: 'Ada',
  lastName: 'Lovelace',
  active: true,
  roleAssignments: [],
};

/** A page with unsaved changes, which asks before anything that leaves it. */
function UnsavedDraft({ ask }: { ask: (proceed: () => void) => void }) {
  useLeaveGuard(true, ask);
  return null;
}

async function submitValidPassword(ask?: (proceed: () => void) => void) {
  const onChanged = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      {ask && <UnsavedDraft ask={ask} />}
      <ChangePasswordDialog onChanged={onChanged} onClose={vi.fn()} open user={user} />
    </QueryClientProvider>,
  );
  const events = userEvent.setup();
  await events.type(document.querySelector('#password') as HTMLElement, 'secret123');
  await events.type(document.querySelector('#confirm') as HTMLElement, 'secret123');
  await events.click(screen.getByRole('button', { name: 'profile.password.submit' }));
  return onChanged;
}

describe('ChangePasswordDialog', () => {
  it('changes the password and reports it', async () => {
    vi.mocked(changePassword).mockResolvedValue();
    const onChanged = await submitValidPassword();

    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(changePassword).toHaveBeenCalledWith('ada', 'secret123');
  });

  it('asks about unsaved changes before sending, since a new password signs the user out', async () => {
    vi.mocked(changePassword).mockReset().mockResolvedValue();
    let proceed: (() => void) | undefined;
    const onChanged = await submitValidPassword((next) => {
      proceed = next;
    });

    expect(proceed).toBeInstanceOf(Function);
    expect(changePassword).not.toHaveBeenCalled();
    proceed?.();
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(changePassword).toHaveBeenCalledOnce();
  });
});

it('warns once about retained work before changing the password and signing out', async () => {
  const check = vi.spyOn(deviceWork, 'countUnsyncedDeviceWork').mockResolvedValue(2);
  vi.mocked(changePassword).mockReset().mockResolvedValue();
  const onChanged = await submitValidPassword();
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('sign-out-device.description');
  expect(changePassword).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'sign-out-offline.confirm' }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  expect(check).toHaveBeenCalledOnce();
  check.mockRestore();
});
