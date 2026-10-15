import { onlineManager } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { router } from '@/integrations/tanstack-router';

it('skips online-only hover preloads offline before gates or loaders can log errors', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'preload', username: 'preload', accessToken: 'token' });
  onlineManager.setOnline(false);
  const error = vi.spyOn(console, 'error');
  const warn = vi.spyOn(console, 'warn');
  expect(await router.preloadRoute({ to: '/administration/users' })).toBeUndefined();
  expect(await router.preloadRoute({ to: '/stock-management/issue' })).toBeUndefined();
  expect(error).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  useLoginData.getState().clearLoginData();
});
