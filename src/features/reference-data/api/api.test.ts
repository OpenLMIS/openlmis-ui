import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionEndedError } from '@/features/auth/lib/session';
import {
  fetchApprovedProducts,
  fetchFacilitiesByIds,
  fetchFacilityOperators,
  fetchFacilityOrderableFulfills,
  fetchFacilityTypes,
  fetchGeographicLevels,
  fetchGeographicZones,
  fetchLotsByIds,
  fetchLotsByTradeItems,
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
  fetchValidAssignments,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import { client } from '@/integrations/axios';
import { assertSessionScope } from '@/lib/session-scope';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn() },
}));

vi.mock('@/lib/session-scope', () => ({ getSessionScope: () => 1, assertSessionScope: vi.fn() }));

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

describe('fetchValidAssignments', () => {
  it.each(['validDestinations', 'validSources'] as const)(
    'reads every page of %s',
    async (resource) => {
      const filter = { programId: 'p1', facilityId: 'f1' };
      get.mockResolvedValueOnce({ data: { content: [{ id: 'a1' }], totalPages: 2 } });
      get.mockResolvedValueOnce({ data: { content: [{ id: 'a2' }], totalPages: 2 } });
      await expect(fetchValidAssignments(resource, filter)).resolves.toEqual([
        { id: 'a1' },
        { id: 'a2' },
      ]);
      expect(get).toHaveBeenNthCalledWith(1, `/${resource}`, {
        params: { ...filter, page: 0, size: 100 },
      });
      expect(get).toHaveBeenNthCalledWith(2, `/${resource}`, {
        params: { ...filter, page: 1, size: 100 },
      });
    },
  );
  it('stops on an empty page and rejects a later failure without a partial list', async () => {
    const filter = { programId: 'p1', facilityId: 'f1' };
    get.mockResolvedValueOnce({ data: { content: [], totalPages: 0 } });
    await expect(fetchValidAssignments('validDestinations', filter)).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
    get.mockResolvedValueOnce({ data: { content: [{ id: 'a1' }], totalPages: 2 } });
    get.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(fetchValidAssignments('validDestinations', filter)).rejects.toThrow('Unavailable');
  });
});

it('stops destination paging when the session changes between pages', async () => {
  get.mockResolvedValueOnce({ data: { content: [{ id: 'a1' }], totalPages: 2 } });
  vi.mocked(assertSessionScope)
    .mockImplementationOnce(() => {})
    .mockImplementationOnce(() => {
      throw new Error('Session ended');
    });
  await expect(
    fetchValidAssignments('validDestinations', { programId: 'p1', facilityId: 'f1' }),
  ).rejects.toThrow('Session ended');
  expect(get).toHaveBeenCalledTimes(1);
});

describe('fetchApprovedProducts', () => {
  it('searches the facility approved products by name, never only the full supply ones', async () => {
    get.mockResolvedValueOnce(page([{ id: 'ap1', orderable: orderable('o1') }]));

    await expect(
      fetchApprovedProducts({ facilityId: 'f1', programId: 'p1', name: 'acid', page: 0, size: 50 }),
    ).resolves.toMatchObject({ content: [{ orderable: orderable('o1') }], totalElements: 1 });
    expect(get).toHaveBeenCalledWith('/facilities/f1/approvedProducts', {
      params: { programId: 'p1', orderableName: 'acid', page: 0, size: 50 },
      paramsSerializer: { indexes: null },
    });
  });

  it('sends a code and repeats each product id when given', async () => {
    get.mockResolvedValueOnce(page([]));

    await fetchApprovedProducts({
      facilityId: 'f1',
      programId: 'p1',
      code: 'C1',
      orderableIds: ['o1', 'o2'],
      page: 1,
      size: 10,
    });
    expect(get).toHaveBeenCalledWith('/facilities/f1/approvedProducts', {
      params: {
        programId: 'p1',
        orderableCode: 'C1',
        orderableId: ['o1', 'o2'],
        page: 1,
        size: 10,
      },
      paramsSerializer: { indexes: null },
    });
  });
});

describe('fetchOrderableFulfills', () => {
  it('asks by product id, repeating the param', async () => {
    const fulfills = { o1: { canBeFulfilledByMe: ['o2'] } };
    get.mockResolvedValueOnce({ data: fulfills });

    await expect(fetchOrderableFulfills(['o1', 'o1'])).resolves.toEqual(fulfills);
    expect(get).toHaveBeenCalledWith('/orderableFulfills', {
      params: { id: ['o1'] },
      paramsSerializer: { indexes: null },
    });
  });

  it('asks for nothing when there are no products, since the server would answer for all', async () => {
    await expect(fetchOrderableFulfills([])).resolves.toEqual({});
    expect(get).not.toHaveBeenCalled();
  });
});

describe('fetchFacilityOrderableFulfills', () => {
  it('asks for the fulfilment map of the facility and program', async () => {
    const fulfills = { a1: { canFulfillForMe: ['o1'] } };
    get.mockResolvedValueOnce({ data: fulfills });

    await expect(
      fetchFacilityOrderableFulfills({ facilityId: 'f1', programId: 'p1' }),
    ).resolves.toEqual(fulfills);
    expect(get).toHaveBeenCalledWith('/orderableFulfills', {
      params: { facilityId: 'f1', programId: 'p1' },
    });
  });
});

describe('fetchLotsByTradeItems', () => {
  const lot = (id: string, tradeItemId: string) => ({
    id,
    lotCode: id.toUpperCase(),
    expirationDate: null,
    tradeItemId,
  });

  it('reads every page of the trade items lots, each lot once', async () => {
    get
      .mockResolvedValueOnce(page([lot('l1', 't1'), lot('l2', 't2')], 2))
      .mockResolvedValueOnce(page([lot('l2', 't2'), lot('l3', 't1')], 2));

    await expect(fetchLotsByTradeItems(['t1', 't2', 't1'])).resolves.toEqual([
      lot('l1', 't1'),
      lot('l2', 't2'),
      lot('l3', 't1'),
    ]);
    expect(get).toHaveBeenLastCalledWith('/lots', {
      params: { tradeItemId: ['t1', 't2'], page: 1, size: 100 },
      paramsSerializer: { indexes: null },
    });
  });

  it('asks for nothing when there are no trade items', async () => {
    await expect(fetchLotsByTradeItems([])).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

it('stops id batches when the session changes after the first request', async () => {
  const ids = Array.from({ length: 101 }, (_, index) => `o${index}`);
  let changed = false;
  get.mockImplementationOnce(async () => {
    changed = true;
    return page([orderable('o0')]);
  });
  get.mockResolvedValue(page([orderable('o100')]));
  vi.mocked(assertSessionScope).mockImplementation((scope) => {
    expect(scope).toBe(1);
    if (changed) throw new Error('Session ended');
  });
  await expect(fetchOrderablesByIds(ids)).rejects.toThrow('Session ended');
  expect(get).toHaveBeenCalledTimes(1);
});

for (const lookup of [fetchOrderablesByIds]) {
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
        return page([orderable(first)]);
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
      const gate = Promise.withResolvers<void>();
      get.mockImplementation(async () => {
        await gate.promise;
        return page([]);
      });
      const pending = lookup(Array.from({ length: 1000 }, (_, index) => `o${index}`));
      expect(get).toHaveBeenCalledTimes(8);
      vi.mocked(assertSessionScope).mockImplementation(() => {
        throw new SessionEndedError();
      });
      gate.resolve();
      await expect(pending).rejects.toBeInstanceOf(SessionEndedError);
      expect(get).toHaveBeenCalledTimes(8);
    });
  });
}
