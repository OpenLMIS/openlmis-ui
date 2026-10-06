import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram, fetchProgram, updateProgram } from '@/features/programs/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);
const put = vi.mocked(client.put);

const arv = {
  id: 'p5',
  code: 'PRG005',
  name: 'ARV',
  description: null,
  active: true,
  periodsSkippable: true,
  skipAuthorization: false,
  showNonFullSupplyTab: true,
  enableDatePhysicalStockCountCompleted: false,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchProgram', () => {
  it('reads one program', async () => {
    get.mockResolvedValueOnce({ data: arv });

    await expect(fetchProgram('p5')).resolves.toEqual(arv);
    expect(get).toHaveBeenCalledWith('/programs/p5');
  });
});

describe('createProgram', () => {
  it('posts the new program', async () => {
    const { id: _id, ...body } = arv;
    post.mockResolvedValueOnce({ data: arv });

    await expect(createProgram(body)).resolves.toEqual(arv);
    expect(post).toHaveBeenCalledWith('/programs', body);
  });
});

describe('updateProgram', () => {
  it('puts the whole program at its id', async () => {
    put.mockResolvedValueOnce({ data: arv });

    await expect(updateProgram('p5', arv)).resolves.toEqual(arv);
    expect(put).toHaveBeenCalledWith('/programs/p5', arv);
  });
});
