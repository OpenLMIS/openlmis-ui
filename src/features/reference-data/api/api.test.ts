import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFacilitiesByIds,
  fetchFacilityOperators,
  fetchFacilityTypes,
  fetchGeographicLevels,
  fetchGeographicZones,
  fetchOrderableDisplayCategories,
  fetchOrganizations,
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

describe('fetchOrderableDisplayCategories', () => {
  it('lists every category in its display order', async () => {
    const category = (code: string, displayOrder: number) => ({
      id: code,
      code,
      displayName: code,
      displayOrder,
    });
    get.mockResolvedValueOnce({ data: [category('C2', 2), category('C1', 1)] });

    await expect(fetchOrderableDisplayCategories()).resolves.toEqual([
      category('C1', 1),
      category('C2', 2),
    ]);
    expect(get).toHaveBeenCalledWith('/orderableDisplayCategories');
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

describe('fetchFacilitiesByIds', () => {
  it('asks for the given facilities in one request, repeating the id param', async () => {
    const balaka = { id: 'f1', name: 'Balaka', geographicZone: { name: 'Balaka' } };
    get.mockResolvedValueOnce({ data: { content: [balaka], totalElements: 1 } });

    await expect(fetchFacilitiesByIds(['f1', 'f2'])).resolves.toEqual([balaka]);
    expect(get).toHaveBeenCalledWith('/facilities', {
      params: { id: ['f1', 'f2'] },
      paramsSerializer: { indexes: null },
    });
  });

  it('asks for nothing when there are no ids, since the endpoint would return every facility', async () => {
    await expect(fetchFacilitiesByIds([])).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('fetchGeographicLevels', () => {
  it('lists the levels from the top down', async () => {
    const district = { id: 'l3', code: 'District', name: 'District', levelNumber: 3 };
    const country = { id: 'l1', code: 'Country', name: 'Country', levelNumber: 1 };
    get.mockResolvedValueOnce({ data: [district, country] });

    await expect(fetchGeographicLevels()).resolves.toEqual([country, district]);
    expect(get).toHaveBeenCalledWith('/geographicLevels');
  });
});

describe('fetchOrganizations', () => {
  it('lists the organizations stock management knows, by name', async () => {
    get.mockResolvedValueOnce({
      data: [
        { id: 'o2', name: 'NGO' },
        { id: 'o1', name: 'CHW' },
      ],
    });

    await expect(fetchOrganizations()).resolves.toEqual([
      { id: 'o1', name: 'CHW' },
      { id: 'o2', name: 'NGO' },
    ]);
    expect(get).toHaveBeenCalledWith('/organizations');
  });
});
