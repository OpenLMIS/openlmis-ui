import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSupplyLinesPage } from '@/features/supply-lines/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

const get = vi.mocked(client.get);

beforeEach(() => get.mockReset());

describe('supply line request contracts', () => {
  it('keeps all displayed list values expanded with stable repeated sorts, excluding extra params', async () => {
    get.mockResolvedValueOnce({ data: { content: [] } });
    await fetchSupplyLinesPage({
      page: 2,
      size: 20,
      sort: 'program.name,desc',
      supplyingFacilityId: 'supplier',
      programId: 'program',
      expand: 'supervisoryNode.requisitionGroup.memberFacilities',
      q: 'unsupported',
    } as Parameters<typeof fetchSupplyLinesPage>[0]);

    const [url, config] = get.mock.calls[0] ?? [];
    const params = config?.params as URLSearchParams;
    expect(url).toBe('/supplyLines');
    expect(params.getAll('sort')).toEqual(['program.name,desc', 'id,asc']);
    expect(params.getAll('expand').toSorted()).toEqual([
      'program',
      'supervisoryNode',
      'supplyingFacility',
    ]);
    expect(
      Object.fromEntries([...params].filter(([key]) => key !== 'sort' && key !== 'expand')),
    ).toEqual({ page: '2', size: '20', supplyingFacilityId: 'supplier', programId: 'program' });
  });
});
