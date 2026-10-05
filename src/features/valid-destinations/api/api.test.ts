import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createValidDestination,
  deleteValidDestination,
  fetchValidDestinations,
} from '@/features/valid-destinations/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const query = { page: 0, size: 10, sort: ['programId,asc', 'id,asc'] };
const body = { programId: 'p1', facilityTypeId: 't1', node: { referenceId: 'f1' } };
const saved = { id: 'a1', ...body };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchValidDestinations', () => {
  it('asks for one page of valid destinations, repeating the sort param', async () => {
    vi.mocked(client.get).mockResolvedValueOnce({ data: { content: [], totalElements: 0 } });

    await fetchValidDestinations(query);
    expect(client.get).toHaveBeenCalledWith('/validDestinations', {
      params: query,
      paramsSerializer: { indexes: null },
    });
  });
});

describe('createValidDestination', () => {
  it('reports a new one as created', async () => {
    vi.mocked(client.post).mockResolvedValueOnce({ data: saved, status: 201 });

    await expect(createValidDestination(body)).resolves.toEqual({
      assignment: saved,
      created: true,
    });
    expect(client.post).toHaveBeenCalledWith('/validDestinations', body);
  });

  it('reports one the server already had as not created', async () => {
    vi.mocked(client.post).mockResolvedValueOnce({ data: saved, status: 200 });

    await expect(createValidDestination(body)).resolves.toEqual({
      assignment: saved,
      created: false,
    });
  });
});

describe('deleteValidDestination', () => {
  it('deletes the one with the given id', async () => {
    vi.mocked(client.delete).mockResolvedValueOnce({ status: 204 });

    await deleteValidDestination('a1');
    expect(client.delete).toHaveBeenCalledWith('/validDestinations/a1');
  });
});
