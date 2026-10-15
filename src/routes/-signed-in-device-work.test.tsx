import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { SignedInDeviceWork } from '@/routes/__root';

vi.mock('@/routes/-device-work-provider', () => ({
  DeviceWorkProvider: ({
    children,
    initialTrigger,
  }: {
    children: ReactNode;
    initialTrigger: string;
  }) => (
    <div data-testid="device-work" data-trigger={initialTrigger}>
      {children}
    </div>
  ),
}));
const login = () =>
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'device-work',
    username: 'Ada',
    accessToken: 'token',
  });
beforeEach(() => useLoginData.getState().clearLoginData());
it('forces downloads after signing in from the signed-out app', async () => {
  render(<SignedInDeviceWork>Content</SignedInDeviceWork>);
  act(login);
  expect(await screen.findByTestId('device-work')).toHaveAttribute('data-trigger', 'force');
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
