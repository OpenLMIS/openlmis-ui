import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { refreshIfSignedIn, rightsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { queryKeys } from '@/lib/key-factory';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));

const ada = { referenceDataUserId: 'ada-id', username: 'ada', accessToken: 'ada-token' };

describe('rightsOptions', () => {
  it('reads the rights by name', async () => {
    vi.mocked(fetchPermissionStrings).mockResolvedValue(['USERS_MANAGE', 'REQUISITION_VIEW|f|p']);

    const rights = await new QueryClient().fetchQuery(rightsOptions('ada-id'));

    expect([...rights]).toEqual(['USERS_MANAGE', 'REQUISITION_VIEW']);
  });

  it('holds no rights for no one, without asking the server', async () => {
    const rights = await new QueryClient().fetchQuery(rightsOptions(''));

    expect(rights.size).toBe(0);
    expect(fetchPermissionStrings).not.toHaveBeenCalled();
  });
});

describe('refreshIfSignedIn', () => {
  function seeded() {
    const queryClient = new QueryClient();
    for (const queryKey of [
      rightsOptions('ada-id').queryKey,
      queryKeys.profile.detail('ada-id'),
      [...queryKeys.home.all, 'first-name', 'ada-id'],
      queryKeys.users.all,
    ]) {
      queryClient.setQueryData(queryKey, {});
    }
    const stale = () =>
      queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => query.isStale())
        .map((query) => query.queryKey[0]);
    return { queryClient, stale };
  }

  beforeEach(() => useLoginData.getState().setLoginData(ada));

  it('reloads your rights, profile and Home when the changed user is you', () => {
    const { queryClient, stale } = seeded();

    refreshIfSignedIn(queryClient, 'ada-id');

    expect(stale()).toEqual(['auth', 'profile', 'home']);
  });

  it('leaves them alone when the changed user is someone else', () => {
    const { queryClient, stale } = seeded();

    refreshIfSignedIn(queryClient, 'alan-id');

    expect(stale()).toEqual([]);
  });
});
