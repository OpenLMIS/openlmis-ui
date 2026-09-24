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
  it('resolves when the user holds the right anywhere', async () => {
    permissionStrings.mockResolvedValueOnce(['USERS_MANAGE', 'REQUISITION_VIEW|f1|p1']);
    await expect(requireRight(new QueryClient(), 'USERS_MANAGE')).resolves.toBeUndefined();
  });

  it('throws a forbidden error when the user does not', async () => {
    permissionStrings.mockResolvedValueOnce(['REQUISITION_VIEW|f1|p1']);
    await expect(requireRight(new QueryClient(), 'USERS_MANAGE')).rejects.toBeInstanceOf(
      ForbiddenError,
    );
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
