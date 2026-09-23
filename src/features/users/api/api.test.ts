import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUsers, findMatchingUserIds } from '@/features/users/api/api';
import type { UsersQuery } from '@/features/users/lib/types';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), post: vi.fn() } }));

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);

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
