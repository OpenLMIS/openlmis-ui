import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { ForbiddenError, isForbidden, requireRight } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';

vi.mock('@/features/auth/api/api', () => ({ fetchPermissionStrings: vi.fn() }));

const permissionStrings = vi.mocked(fetchPermissionStrings);

beforeEach(() => {
  permissionStrings.mockReset();
  useLoginData.setState({ referenceDataUserId: 'u1' });
});

describe('requireRight', () => {
  it('resolves with all the rights when the user holds the one asked for anywhere', async () => {
    permissionStrings.mockResolvedValueOnce(['USERS_MANAGE', 'REQUISITION_VIEW|f1|p1']);
    await expect(requireRight(new QueryClient(), 'USERS_MANAGE')).resolves.toEqual(
      new Set(['USERS_MANAGE', 'REQUISITION_VIEW']),
    );
  });

  it('throws a forbidden error when the user does not', async () => {
    permissionStrings.mockResolvedValueOnce(['REQUISITION_VIEW|f1|p1']);
    await expect(requireRight(new QueryClient(), 'USERS_MANAGE')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('resolves when the user holds any one of several rights asked for', async () => {
    permissionStrings.mockResolvedValueOnce(['FACILITY_APPROVED_ORDERABLES_MANAGE']);
    await expect(
      requireRight(new QueryClient(), ['ORDERABLES_MANAGE', 'FACILITY_APPROVED_ORDERABLES_MANAGE']),
    ).resolves.toEqual(new Set(['FACILITY_APPROVED_ORDERABLES_MANAGE']));
  });

  it('throws a forbidden error naming every right when the user holds none of them', async () => {
    permissionStrings.mockResolvedValueOnce(['USERS_MANAGE']);
    await expect(
      requireRight(new QueryClient(), ['ORDERABLES_MANAGE', 'FACILITY_APPROVED_ORDERABLES_MANAGE']),
    ).rejects.toThrow('Missing right ORDERABLES_MANAGE or FACILITY_APPROVED_ORDERABLES_MANAGE');
  });

  it('throws without asking the server when nobody is signed in', async () => {
    useLoginData.setState({ referenceDataUserId: null });
    await expect(requireRight(new QueryClient(), 'USERS_MANAGE')).rejects.toBeInstanceOf(
      ForbiddenError,
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
