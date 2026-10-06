import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFacilitiesByIds,
  fetchFacilityOperators,
  fetchFacilityTypes,
  fetchGeographicLevels,
  fetchGeographicZones,
  fetchOrderableDisplayCategories,
  fetchOrderables,
  fetchOrderablesByIds,
  fetchOrderablesByTradeItems,
  fetchOrganizations,
  fetchReasons,
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

describe('fetchReasons', () => {
  it('lists every reason in one request, since the endpoint cannot page', async () => {
    const reason = {
      id: 'r1',
      name: 'Damage',
      reasonType: 'DEBIT',
      reasonCategory: 'ADJUSTMENT',
      isFreeTextAllowed: false,
      tags: [],
    };
    get.mockResolvedValueOnce({ data: [reason] });

    await expect(fetchReasons()).resolves.toEqual([reason]);
    expect(get).toHaveBeenCalledWith('/stockCardLineItemReasons');
  });
});

const orderable = (id: string, tradeItem?: string, versionNumber = 1) => ({
  id,
  productCode: id.toUpperCase(),
  fullProductName: `Product ${id}`,
  description: null,
  ...(tradeItem && { identifiers: { tradeItem } }),
  meta: { versionNumber },
});

const page = <T>(content: T[], totalPages = 1) => ({
  data: { content, totalElements: content.length, totalPages },
});

describe('fetchOrderables', () => {
  it('searches by name, one page sorted by name, as the server has no code-or-name search', async () => {
    get.mockResolvedValueOnce(page([orderable('o1')]));

    await expect(fetchOrderables(' acid ')).resolves.toEqual({
      content: [orderable('o1')],
      totalElements: 1,
      totalPages: 1,
    });
    expect(get).toHaveBeenCalledWith('/orderables', {
      params: { page: 0, size: 20, sort: 'fullProductName,asc', name: 'acid' },
    });
  });

  it('sends no search when nothing is typed', async () => {
    get.mockResolvedValueOnce(page([]));

    await fetchOrderables('  ');
    expect(get).toHaveBeenCalledWith('/orderables', {
      params: { page: 0, size: 20, sort: 'fullProductName,asc' },
    });
  });
});

describe('fetchOrderablesByIds', () => {
  it('reads the named products in one request, each id as its own param', async () => {
    get.mockResolvedValueOnce(page([orderable('o1')]));

    await expect(fetchOrderablesByIds(['o1', 'o2'])).resolves.toEqual([orderable('o1')]);
    expect(get).toHaveBeenCalledWith('/orderables', {
      params: { id: ['o1', 'o2'] },
      paramsSerializer: { indexes: null },
    });
  });

  it('asks for nothing when there is nothing to name', async () => {
    await expect(fetchOrderablesByIds([])).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('fetchOrderablesByTradeItems', () => {
  it('reads the products of the given trade items in one request', async () => {
    get.mockResolvedValueOnce(page([orderable('o1', 't1'), orderable('o2', 't2')]));

    await expect(fetchOrderablesByTradeItems(['t1', 't2'])).resolves.toEqual([
      orderable('o1', 't1'),
      orderable('o2', 't2'),
    ]);
    expect(get).toHaveBeenCalledWith('/orderables', {
      params: { tradeItemId: ['t1', 't2'], page: 0, size: 100 },
      paramsSerializer: { indexes: null },
    });
  });

  it('keeps only the latest version of a product, since every version comes back', async () => {
    get.mockResolvedValueOnce(page([orderable('o1', 't1', 1), orderable('o1', 't1', 2)]));

    await expect(fetchOrderablesByTradeItems(['t1'])).resolves.toEqual([orderable('o1', 't1', 2)]);
  });

  it('matches trade items whatever their case', async () => {
    get.mockResolvedValueOnce(page([orderable('o1', 'ABC-1')]));

    await expect(fetchOrderablesByTradeItems(['abc-1'])).resolves.toEqual([
      orderable('o1', 'ABC-1'),
    ]);
  });

  it('reads further pages when the products do not fit in one', async () => {
    get
      .mockResolvedValueOnce(page([orderable('o1', 't1')], 2))
      .mockResolvedValueOnce(page([orderable('o2', 't2')], 2));

    await expect(fetchOrderablesByTradeItems(['t1', 't2'])).resolves.toEqual([
      orderable('o1', 't1'),
      orderable('o2', 't2'),
    ]);
    expect(get).toHaveBeenLastCalledWith('/orderables', {
      params: { tradeItemId: ['t1', 't2'], page: 1, size: 100 },
      paramsSerializer: { indexes: null },
    });
  });

  it('finds none when no product has the trade items, though the server then lists every product', async () => {
    get.mockResolvedValueOnce(page([orderable('o1', 'other'), orderable('o2')], 103));

    await expect(fetchOrderablesByTradeItems(['t1'])).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing when there are no trade items', async () => {
    await expect(fetchOrderablesByTradeItems([])).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});
