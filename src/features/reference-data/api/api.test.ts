import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFacilityTypes } from '@/features/reference-data/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn() },
}));

const get = vi.mocked(client.get);

const warehouse = {
  id: 'ft1',
  code: 'warehouse',
  name: 'Warehouse',
  description: null,
  displayOrder: 1,
  active: true,
  primaryHealthCare: false,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchFacilityTypes', () => {
  it('asks for every type without paging, which the endpoint answers with all of them', async () => {
    get.mockResolvedValueOnce({ data: { content: [warehouse], totalElements: 1 } });

    await expect(fetchFacilityTypes()).resolves.toEqual([warehouse]);
    expect(get).toHaveBeenCalledWith('/facilityTypes', { params: {} });
  });

  it('asks for the active ones only when told to', async () => {
    get.mockResolvedValueOnce({ data: { content: [warehouse], totalElements: 1 } });

    await fetchFacilityTypes({ active: true });
    expect(get).toHaveBeenCalledWith('/facilityTypes', { params: { active: true } });
  });
});
