import { onlineManager } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { router } from '@/integrations/tanstack-router';
import { getSessionScope } from '@/lib/session-scope';

it('skips online-only hover preloads offline before gates or loaders can log errors', async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'preload', username: 'preload', accessToken: 'token' });
  onlineManager.setOnline(false);
  const error = vi.spyOn(console, 'error');
  const warn = vi.spyOn(console, 'warn');
  expect(await router.preloadRoute({ to: '/administration/users' })).toBeUndefined();
  expect(await router.preloadRoute({ to: '/stock-management/receive' })).toBeUndefined();
  expect(error).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  useLoginData.getState().clearLoginData();
});

it('does not reuse a resolved protected page for another identity offline', () => {
  useLoginData.getState().setLoginData({
    referenceDataUserId: 'first',
    username: 'first',
    accessToken: 'token',
  });
  const state = router.state;
  const matches = router.matchRoutes('/administration/users').map((match) => ({
    ...match,
    status: 'success' as const,
    context: { ...match.context, sessionScope: getSessionScope() },
  }));
  const resolvedLocation = router.buildLocation({ to: '/administration/users' });
  const stateSpy = vi.spyOn(router, 'state', 'get').mockReturnValue({
    ...state,
    matches,
    resolvedLocation,
  });
  try {
    onlineManager.setOnline(false);
    expect(router.options.context?.getResolvedPathname?.()).toBe('/administration/users');
    useLoginData.getState().setLoginData({
      referenceDataUserId: 'second',
      username: 'second',
      accessToken: 'other-token',
    });
    expect(router.options.context?.getResolvedPathname?.()).toBeUndefined();
  } finally {
    stateSpy.mockRestore();
    useLoginData.getState().clearLoginData();
  }
});
