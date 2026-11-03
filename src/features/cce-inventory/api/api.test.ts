import { beforeEach, expect, it, vi } from 'vitest';
import {
  fetchCatalogItems,
  fetchInventoryAlerts,
  fetchInventoryItems,
} from '@/features/cce-inventory/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

const get = vi.mocked(client.get);

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { content: [], totalElements: 0 } });
});

it('asks for the modifier names and repeats sort keys as Spring binds them', async () => {
  await fetchInventoryItems({
    facilityId: 'f',
    programId: 'p',
    page: 0,
    size: 10,
    sort: ['type,asc', 'referenceName,asc', 'id,asc'],
  });

  expect(get).toHaveBeenCalledWith('/inventoryItems', {
    params: {
      facilityId: 'f',
      programId: 'p',
      page: 0,
      size: 10,
      sort: ['type,asc', 'referenceName,asc', 'id,asc'],
      expand: 'lastModifier',
    },
    paramsSerializer: { indexes: null },
  });
});

it('asks for the alerts of the page devices as repeated deviceId params', async () => {
  await fetchInventoryAlerts(['fridge', 'freezer']);

  expect(get).toHaveBeenCalledWith('/cceAlerts', {
    params: { deviceId: ['fridge', 'freezer'] },
    paramsSerializer: { indexes: null },
  });
});

it('reads every visible, unarchived catalog item in one request, as legacy', async () => {
  get.mockResolvedValueOnce({ data: { content: [{ id: 'c1' }], totalElements: 1 } });

  await expect(fetchCatalogItems()).resolves.toEqual([{ id: 'c1' }]);
  expect(get).toHaveBeenCalledWith('/catalogItems', {
    params: { archived: false, visibleInCatalog: true },
  });
});
