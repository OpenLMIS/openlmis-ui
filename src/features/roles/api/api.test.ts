import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRole, fetchRightsByType, fetchRole, updateRole } from '@/features/roles/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);
const put = vi.mocked(client.put);

const right = { id: 'r1', name: 'ORDERS_VIEW', type: 'ORDER_FULFILLMENT' } as const;
const body = { name: 'Clerk', description: 'Views orders', rights: [right] };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchRole', () => {
  it('reads one role', async () => {
    get.mockResolvedValueOnce({ data: { id: 'role1', ...body } });

    await expect(fetchRole('role1')).resolves.toMatchObject({ id: 'role1' });
    expect(get).toHaveBeenCalledWith('/roles/role1');
  });
});

describe('fetchRightsByType', () => {
  it('searches the rights of one type', async () => {
    get.mockResolvedValueOnce({ data: [right] });

    await expect(fetchRightsByType('ORDER_FULFILLMENT')).resolves.toEqual([right]);
    expect(get).toHaveBeenCalledWith('/rights/search', { params: { type: 'ORDER_FULFILLMENT' } });
  });
});

describe('createRole', () => {
  it('posts the new role', async () => {
    post.mockResolvedValueOnce({ data: { id: 'role1', ...body } });

    await expect(createRole(body)).resolves.toMatchObject({ id: 'role1' });
    expect(post).toHaveBeenCalledWith('/roles', body);
  });
});

describe('updateRole', () => {
  it('puts the whole role at its id', async () => {
    put.mockResolvedValueOnce({ data: { id: 'role1', ...body } });

    await updateRole('role1', { id: 'role1', ...body });
    expect(put).toHaveBeenCalledWith('/roles/role1', { id: 'role1', ...body });
  });
});
