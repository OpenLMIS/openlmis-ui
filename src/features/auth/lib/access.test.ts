import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import {
  ForbiddenError,
  isForbidden,
  requirePermissions,
  requireRouteRights,
} from '@/features/auth/lib/access';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import { queryClient } from '@/integrations/tanstack-query';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));

const permissionStrings = vi.mocked(fetchPermissionStrings);

beforeEach(() => {
  permissionStrings.mockReset();
  useLoginData.setState({ referenceDataUserId: 'u1' });
});

describe('requirePermissions', () => {
  it('resolves with all the rights when the user holds the one asked for anywhere', async () => {
    permissionStrings.mockResolvedValueOnce(['USERS_MANAGE', 'REQUISITION_VIEW|f1|p1']);
    await expect(requirePermissions(new QueryClient(), 'USERS_MANAGE')).resolves.toMatchObject({
      rights: new Set(['USERS_MANAGE', 'REQUISITION_VIEW']),
    });
  });

  it('throws a forbidden error when the user does not', async () => {
    permissionStrings.mockResolvedValueOnce(['REQUISITION_VIEW|f1|p1']);
    await expect(requirePermissions(new QueryClient(), 'USERS_MANAGE')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('resolves when the user holds any one of several rights asked for', async () => {
    permissionStrings.mockResolvedValueOnce(['FACILITY_APPROVED_ORDERABLES_MANAGE']);
    await expect(
      requirePermissions(new QueryClient(), [
        'ORDERABLES_MANAGE',
        'FACILITY_APPROVED_ORDERABLES_MANAGE',
      ]),
    ).resolves.toMatchObject({ rights: new Set(['FACILITY_APPROVED_ORDERABLES_MANAGE']) });
  });

  it('throws a forbidden error naming every right when the user holds none of them', async () => {
    permissionStrings.mockResolvedValueOnce(['USERS_MANAGE']);
    await expect(
      requirePermissions(new QueryClient(), [
        'ORDERABLES_MANAGE',
        'FACILITY_APPROVED_ORDERABLES_MANAGE',
      ]),
    ).rejects.toThrow('Missing right ORDERABLES_MANAGE or FACILITY_APPROVED_ORDERABLES_MANAGE');
  });

  it.each([false, true])(
    'checks the new identity when rights finish after a user change (cache cleared: %s)',
    async (clearCache) => {
      let release!: (rights: string[]) => void;
      permissionStrings.mockReturnValueOnce(
        new Promise((resolve) => {
          release = resolve;
        }),
      );
      permissionStrings.mockResolvedValueOnce(['USERS_MANAGE']);
      const client = clearCache ? queryClient : new QueryClient();
      const pending = requirePermissions(client, 'USERS_MANAGE');
      useLoginData.setState({ referenceDataUserId: 'u2' });
      release(['USERS_MANAGE', 'STOCK_ADJUST|old-home|old-program']);

      await expect(pending).resolves.toMatchObject({ rights: new Set(['USERS_MANAGE']) });
      expect(permissionStrings.mock.calls.map(([id]) => id)).toEqual(['u1', 'u2']);
      client.clear();
    },
  );

  it('ends a rights retry when the user signs out', async () => {
    let release!: (rights: string[]) => void;
    permissionStrings.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const pending = requirePermissions(new QueryClient(), 'USERS_MANAGE');
    useLoginData.getState().clearLoginData();
    release(['USERS_MANAGE']);
    await expect(pending).rejects.toBeInstanceOf(SessionEndedError);
  });

  it('throws without asking the server when nobody is signed in', async () => {
    useLoginData.setState({ referenceDataUserId: null });
    await expect(requirePermissions(new QueryClient(), 'USERS_MANAGE')).rejects.toBeInstanceOf(
      SessionEndedError,
    );
    expect(permissionStrings).not.toHaveBeenCalled();
  });
});

describe('isForbidden', () => {
  it('counts a refusal from the server too', () => {
    const refused = Object.assign(new Error(), { isAxiosError: true, response: { status: 403 } });
    expect(isForbidden(refused)).toBe(true);
    expect(isForbidden(new ForbiddenError('USERS_MANAGE'))).toBe(true);
    expect(isForbidden(new Error('offline'))).toBe(false);
  });
});

describe('requireRouteRights', () => {
  const parentRoute = { options: { staticData: { rights: ['ORDERS_VIEW', 'PODS_MANAGE'] } } };

  it('accepts any inherited right', async () => {
    permissionStrings.mockResolvedValueOnce(['PODS_MANAGE|facility']);
    await expect(
      requireRouteRights(new QueryClient(), { options: {}, parentRoute }),
    ).resolves.toMatchObject({ rights: new Set(['PODS_MANAGE']) });
  });

  it.each([[['USERS_MANAGE']], [[]]])('uses the nearest declaration (%j)', async (rights) => {
    permissionStrings.mockResolvedValueOnce(['PODS_MANAGE']);
    await expect(
      requireRouteRights(new QueryClient(), { options: { staticData: { rights } }, parentRoute }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('fails closed without a declaration', async () => {
    await expect(requireRouteRights(new QueryClient(), { options: {} })).rejects.toThrow(
      'Route has no rights declaration',
    );
    expect(permissionStrings).not.toHaveBeenCalled();
  });
});
