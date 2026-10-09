import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchFacilitiesByIds,
  fetchFacilityOperators,
  fetchFacilityTypes,
  fetchGeographicLevels,
  fetchGeographicZones,
  fetchLotsByIds,
  fetchOrderableDisplayCategories,
  fetchOrderableFulfills,
  fetchOrderables,
  fetchOrderablesByIds,
  fetchOrderablesByTradeItems,
  fetchOrganizations,
  fetchReasons,
  fetchTradeItemByGtin,
  fetchUserPrograms,
  fetchUserRecord,
  fetchValidReasons,
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
  it('searches by name, one page sorted by name', async () => {
    get.mockResolvedValueOnce(page([orderable('o1')]));

    await expect(fetchOrderables({ name: 'acid' })).resolves.toEqual({
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

    await fetchOrderables({ name: '', code: '' });
    expect(get).toHaveBeenCalledWith('/orderables', {
      params: { page: 0, size: 20, sort: 'fullProductName,asc' },
    });
  });

  it('reads the page and page size asked for, as a paged table does', async () => {
    get.mockResolvedValueOnce(page([]));

    await fetchOrderables({ name: 'acid', page: 2, size: 10 });
    expect(get).toHaveBeenCalledWith('/orderables', {
      params: { page: 2, size: 10, sort: 'fullProductName,asc', name: 'acid' },
    });
  });

  it('sends a code and a name as the separate filters the server matches together', async () => {
    get.mockResolvedValueOnce(page([]));

    await fetchOrderables({ name: 'acid', code: 'C1' });
    expect(get).toHaveBeenCalledWith('/orderables', {
      params: { page: 0, size: 20, sort: 'fullProductName,asc', name: 'acid', code: 'C1' },
    });
  });
});

describe('fetchOrderablesByIds', () => {
  it('reads the named products, each id as its own param, a page of 100 at a time', async () => {
    get.mockResolvedValueOnce(page([orderable('o1')]));

    await expect(fetchOrderablesByIds(['o1', 'o2', 'o1'])).resolves.toEqual([orderable('o1')]);
    expect(get).toHaveBeenCalledWith('/orderables', {
      params: { id: ['o1', 'o2'], page: 0, size: 100 },
      paramsSerializer: { indexes: null },
    });
  });

  it('asks for nothing when there is nothing to name', async () => {
    await expect(fetchOrderablesByIds([])).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it('splits more than 100 ids into batches, so no query string grows too long', async () => {
    const ids = Array.from({ length: 150 }, (_, index) => `o${index}`);
    get
      .mockResolvedValueOnce(page([orderable('o0')]))
      .mockResolvedValueOnce(page([orderable('o100')]));

    await expect(fetchOrderablesByIds(ids)).resolves.toEqual([orderable('o0'), orderable('o100')]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0]?.[1]?.params).toMatchObject({ id: ids.slice(0, 100) });
    expect(get.mock.calls[1]?.[1]?.params).toMatchObject({ id: ids.slice(100) });
  });

  it('reads further pages when the server sends fewer per page than asked', async () => {
    get
      .mockResolvedValueOnce(page([orderable('o1')], 2))
      .mockResolvedValueOnce(page([orderable('o2')], 2));

    await expect(fetchOrderablesByIds(['o1', 'o2'])).resolves.toEqual([
      orderable('o1'),
      orderable('o2'),
    ]);
    expect(get).toHaveBeenLastCalledWith('/orderables', {
      params: { id: ['o1', 'o2'], page: 1, size: 100 },
      paramsSerializer: { indexes: null },
    });
  });

  it('keeps the latest version when a product comes back twice', async () => {
    get.mockResolvedValueOnce(page([orderable('o1', undefined, 1), orderable('o1', undefined, 3)]));

    await expect(fetchOrderablesByIds(['o1'])).resolves.toEqual([orderable('o1', undefined, 3)]);
  });
});

describe('fetchLotsByIds', () => {
  it('reads the named lots a page of 100 at a time, each id once', async () => {
    const lot = { id: 'l1', lotCode: 'L-1', expirationDate: '2027-01-31' };
    get.mockResolvedValueOnce(page([lot]));

    await expect(fetchLotsByIds(['l1', 'l1'])).resolves.toEqual([lot]);
    expect(get).toHaveBeenCalledWith('/lots', {
      params: { id: ['l1'], page: 0, size: 100 },
      paramsSerializer: { indexes: null },
    });
  });

  it('asks for nothing when there is nothing to name', async () => {
    await expect(fetchLotsByIds([])).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('fetchUserRecord', () => {
  it('reads the user whole', async () => {
    get.mockResolvedValueOnce({ data: { id: 'u1', homeFacilityId: 'f1' } });

    await expect(fetchUserRecord('u1')).resolves.toEqual({ id: 'u1', homeFacilityId: 'f1' });
    expect(get).toHaveBeenCalledWith('/users/u1');
  });
});

describe('fetchUserPrograms', () => {
  it('reads the programs the user has a role for', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 'p1', code: 'EM', name: 'Essential Meds' }] });

    await expect(fetchUserPrograms('u1')).resolves.toEqual([
      { id: 'p1', code: 'EM', name: 'Essential Meds' },
    ]);
    expect(get).toHaveBeenCalledWith('/users/u1/programs');
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

describe('fetchValidReasons', () => {
  it('requests every assignment for this program and facility type', async () => {
    const assignment = { hidden: false, reason: { id: 'r1' } };
    get.mockResolvedValueOnce({ data: [assignment] });
    await expect(fetchValidReasons({ program: 'p1', facilityType: 'ft1' })).resolves.toEqual([
      assignment,
    ]);
    expect(get).toHaveBeenCalledWith('/validReasons', {
      params: { program: 'p1', facilityType: 'ft1' },
    });
  });
});

describe('fetchTradeItemByGtin', () => {
  it('returns the first matched trade item', async () => {
    get.mockResolvedValueOnce(page([{ id: 't1' }, { id: 't2' }]));
    await expect(fetchTradeItemByGtin('01234567890128')).resolves.toEqual({ id: 't1' });
    expect(get).toHaveBeenCalledWith('/tradeItems', { params: { gtin: '01234567890128' } });
  });
  it('returns null when there is no matching trade item', async () => {
    get.mockResolvedValueOnce(page([]));
    await expect(fetchTradeItemByGtin('01234567890128')).resolves.toBeNull();
  });
});

for (const lookup of [fetchOrderablesByIds, fetchOrderableFulfills]) {
  describe(`${lookup.name} batch pool`, () => {
    it('starts eight batches, bounds concurrent requests and preserves batch order', async () => {
      const ids = Array.from({ length: 1000 }, (_, index) => `o${index}`);
      const gates = Array.from({ length: 10 }, () => Promise.withResolvers<void>());
      let running = 0;
      let most = 0;
      get.mockImplementation(async (_path, config) => {
        const first = ((config?.params ?? {}) as { id: string[] }).id[0];
        const index = Number(first.slice(1)) / 100;
        running += 1;
        most = Math.max(most, running);
        await gates[index].promise;
        running -= 1;
        return lookup === fetchOrderableFulfills
          ? { data: { [first]: { canFulfillForMe: [first] } } }
          : page([orderable(first)]);
      });
      const pending = lookup(ids);
      expect(get).toHaveBeenCalledTimes(8);
      for (const gate of gates.toReversed()) gate.resolve();
      const result = await pending;
      expect(most).toBe(8);
      const expected = ids.filter((_, index) => index % 100 === 0);
      expect(Array.isArray(result) ? result.map((item) => item.id) : Object.keys(result)).toEqual(
        expected,
      );
    });
    it('rejects the whole lookup if any batch fails', async () => {
      const error = new Error('batch failed');
      get.mockRejectedValueOnce(error).mockResolvedValue(page([]));
      await expect(lookup(Array.from({ length: 900 }, (_, index) => `o${index}`))).rejects.toBe(
        error,
      );
    });
    it('checks scope before queued requests and rejects after an in-flight session change', async () => {
      useLoginData
        .getState()
        .setLoginData({ referenceDataUserId: 'first', username: 'first', accessToken: 'token' });
      const gate = Promise.withResolvers<void>();
      get.mockImplementation(async () => {
        await gate.promise;
        return page([]);
      });
      const pending = lookup(Array.from({ length: 1000 }, (_, index) => `o${index}`));
      expect(get).toHaveBeenCalledTimes(8);
      useLoginData.getState().clearLoginData();
      gate.resolve();
      await expect(pending).rejects.toBeInstanceOf(SessionEndedError);
      expect(get).toHaveBeenCalledTimes(8);
    });
  });
}
