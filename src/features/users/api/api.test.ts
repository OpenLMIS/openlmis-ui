import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUser,
  fetchUserDetails,
  fetchUsers,
  findMatchingUserIds,
  sendPasswordResetEmail,
  setUserPassword,
  updateUser,
  updateUserRoles,
} from '@/features/users/api/api';
import type { UsersQuery } from '@/features/users/lib/types';
import { EMPTY_USER_FORM } from '@/features/users/lib/user-form';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);
const put = vi.mocked(client.put);
const remove = vi.mocked(client.delete);

const query: UsersQuery = { page: 0, size: 10, sort: 'username,asc' };

const page = <T>(content: T[], totalElements = content.length) => ({
  data: { content, totalElements, totalPages: 1, number: 0, size: 10 },
});

const ada = { id: 'u1', username: 'ada', firstName: 'Ada', lastName: 'Lovelace', active: true };
const alan = { id: 'u2', username: 'alan', firstName: 'Alan', lastName: 'Turing', active: false };

const contact = (id: string, email: string | null) => ({
  referenceDataUserId: id,
  emailDetails: { email },
});

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  remove.mockReset();
});

describe('fetchUsers', () => {
  it('pages all users with the status filter and joins each with its email', async () => {
    post.mockResolvedValueOnce(page([ada, alan], 42));
    get.mockResolvedValueOnce(page([contact('u1', 'ada@example.org')]));

    const result = await fetchUsers({ ...query, active: true });

    expect(post).toHaveBeenCalledWith(
      '/users/search',
      { id: undefined, active: true },
      { params: { page: 0, size: 10, sort: 'username,asc' } },
    );
    expect(result.totalElements).toBe(42);
    expect(result.content).toEqual([
      { ...ada, email: 'ada@example.org' },
      { ...alan, email: null },
    ]);
  });

  it('narrows the page to the given ids', async () => {
    post.mockResolvedValueOnce(page([alan]));
    get.mockResolvedValueOnce(page([]));

    await fetchUsers(query, ['u2']);

    expect(post).toHaveBeenCalledWith(
      '/users/search',
      { id: ['u2'], active: undefined },
      expect.anything(),
    );
  });

  it('skips paging when the search matched nobody', async () => {
    const result = await fetchUsers(query, []);

    expect(post).not.toHaveBeenCalled();
    expect(result).toMatchObject({ content: [], totalElements: 0 });
  });
});

describe('findMatchingUserIds', () => {
  it('merges matches on username, first name, last name and email', async () => {
    get.mockImplementation(async (url, config) => {
      const params = (config?.params ?? {}) as Record<string, unknown>;
      if (url === '/userContactDetails') return page([contact('u3', 'a@t.org')]);
      if (params.username) return page([ada]);
      if (params.firstName) return page([ada, alan]);
      return page([]);
    });

    expect(new Set(await findMatchingUserIds('a'))).toEqual(new Set(['u1', 'u2', 'u3']));
  });

  it('also matches a full name across the first and last name', async () => {
    get.mockResolvedValue(page([]));

    await findMatchingUserIds('Ada Lovelace');

    expect(get).toHaveBeenCalledWith(
      '/users',
      expect.objectContaining({
        params: expect.objectContaining({ firstName: 'Ada', lastName: 'Lovelace' }),
      }),
    );
  });
});

const newUser = { ...EMPTY_USER_FORM, username: ' ada ', firstName: 'Ada', lastName: 'Lovelace' };

describe('createUser', () => {
  it('creates the user, then its contact details and sign-in account', async () => {
    put.mockResolvedValueOnce({ data: { ...ada, roleAssignments: [] } });
    put.mockResolvedValueOnce({ data: {} });
    post.mockResolvedValueOnce({ data: {} });

    await createUser(newUser);

    expect(put).toHaveBeenNthCalledWith(1, '/users', expect.objectContaining({ username: 'ada' }));
    expect(put).toHaveBeenNthCalledWith(2, '/userContactDetails/u1', expect.anything());
    expect(post).toHaveBeenCalledWith('/users/auth', { id: 'u1', username: 'ada', enabled: true });
    expect(remove).not.toHaveBeenCalled();
  });

  it('removes the half-created user when the account cannot be created', async () => {
    const failure = new Error('username taken');
    put.mockResolvedValueOnce({ data: { ...ada, roleAssignments: [] } });
    put.mockResolvedValueOnce({ data: {} });
    post.mockRejectedValueOnce(failure);
    remove.mockResolvedValueOnce({ data: {} });

    await expect(createUser(newUser)).rejects.toBe(failure);
    expect(remove).toHaveBeenCalledWith('/users/u1');
  });
});

describe('fetchUserDetails', () => {
  it('treats missing contact details and account as none', async () => {
    const notFound = Object.assign(new Error('not found'), {
      isAxiosError: true,
      response: { status: 404 },
    });
    get.mockResolvedValueOnce({ data: { ...ada, roleAssignments: [] } });
    get.mockRejectedValueOnce(notFound);
    get.mockRejectedValueOnce(notFound);

    await expect(fetchUserDetails('u1')).resolves.toEqual({
      user: { ...ada, roleAssignments: [] },
      contact: null,
      auth: null,
    });
  });
});

describe('updateUser', () => {
  const details = { user: { ...ada, roleAssignments: [] }, contact: null, auth: null };

  it('stops at the first rejected write', async () => {
    put.mockResolvedValueOnce({ data: {} });
    put.mockRejectedValueOnce(new Error('email taken'));

    await expect(updateUser(details, newUser)).rejects.toThrow('email taken');
    expect(put).toHaveBeenCalledTimes(2);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('passwords', () => {
  it('sets a typed password for the username', async () => {
    post.mockResolvedValueOnce({ data: {} });
    await setUserPassword('ada', 'secret123');
    expect(post).toHaveBeenCalledWith('/users/auth/passwordReset', {
      username: 'ada',
      newPassword: 'secret123',
    });
  });

  it('sends the reset link to the address as a query parameter', async () => {
    post.mockResolvedValueOnce({ data: {} });
    await sendPasswordResetEmail('ada@example.org');
    expect(post).toHaveBeenCalledWith('/users/auth/forgotPassword', undefined, {
      params: { email: 'ada@example.org' },
    });
  });
});

describe('updateUserRoles', () => {
  it('saves the fresh user with only the new roles changed, and touches nothing else', async () => {
    const fresh = { ...ada, homeFacilityId: 'f1', active: false, roleAssignments: [] };
    get.mockResolvedValueOnce({ data: fresh });
    put.mockResolvedValueOnce({ data: { ...fresh, roleAssignments: [{ roleId: 'r' }] } });

    const saved = await updateUserRoles('u1', [
      { roleId: 'r', programId: null, supervisoryNodeId: undefined },
    ]);

    expect(get).toHaveBeenCalledWith('/users/u1');
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/users', { ...fresh, roleAssignments: [{ roleId: 'r' }] });
    expect(post).not.toHaveBeenCalled();
    expect(saved.roleAssignments).toEqual([{ roleId: 'r' }]);
  });

  it('saves nothing when the user cannot be read', async () => {
    get.mockRejectedValueOnce(new Error('offline'));

    await expect(updateUserRoles('u1', [])).rejects.toThrow('offline');
    expect(put).not.toHaveBeenCalled();
  });
});
