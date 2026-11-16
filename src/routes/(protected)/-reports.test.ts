import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { canOpen } from '@/components/app-shell/nav-access';
import { permissionsOptions } from '@/features/auth/api/queries';
import { ForbiddenError } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { parsePermissions } from '@/lib/permissions';
import { Route } from '@/routes/(protected)/_protected.reports';

afterEach(() => {
  useLoginData.setState({ referenceDataUserId: undefined });
});

it.each([false, true])(
  'guards direct report loading and the menu consistently, allowed: %s',
  async (allowed) => {
    useLoginData.setState({ referenceDataUserId: 'user' });
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      permissionsOptions('user').queryKey,
      parsePermissions(allowed ? ['REPORTS_VIEW'] : ['USERS_MANAGE']),
    );
    const prefetch = vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue();
    const loader = Route.options.loader;
    if (typeof loader !== 'function') throw new Error('Expected reports loader');
    try {
      const result = loader({ context: { queryClient } } as Parameters<typeof loader>[0]);
      if (allowed) {
        await expect(result).resolves.toMatchObject({ userId: 'user' });
        expect(prefetch).toHaveBeenCalledTimes(4);
      } else {
        await expect(result).rejects.toBeInstanceOf(ForbiddenError);
        expect(prefetch).not.toHaveBeenCalled();
      }
      expect(canOpen('/reports', new Set(allowed ? ['REPORTS_VIEW'] : ['USERS_MANAGE']))).toBe(
        allowed,
      );
    } finally {
      queryClient.clear();
    }
  },
);
