import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFacilityOperators,
  fetchFacilityTypes,
  fetchGeographicZones,
} from '@/features/reference-data/api/api';
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

describe('fetchGeographicZones', () => {
  it('asks for every zone sorted by name, which the endpoint answers in one page', async () => {
    const gaza = { id: 'z1', code: 'gaza', name: 'Gaza', level: { name: 'Province' } };
    get.mockResolvedValueOnce({ data: { content: [gaza], totalElements: 1 } });

    await expect(fetchGeographicZones()).resolves.toEqual([gaza]);
    expect(get).toHaveBeenCalledWith('/geographicZones', { params: { sort: 'name,asc' } });
  });
});

describe('fetchFacilityOperators', () => {
  it('reads the operators, which the endpoint lists as a plain array', async () => {
    const moh = { id: 'o1', code: 'moh', name: 'Ministry of Health' };
    get.mockResolvedValueOnce({ data: [moh] });

    await expect(fetchFacilityOperators()).resolves.toEqual([moh]);
    expect(get).toHaveBeenCalledWith('/facilityOperators');
  });
});
