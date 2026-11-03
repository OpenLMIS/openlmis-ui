import { beforeEach, expect, it, vi } from 'vitest';
import {
  createInventoryItem,
  fetchCatalogItems,
  fetchInventoryAlerts,
  fetchInventoryItems,
} from '@/features/cce-inventory/api/api';
import type { InventoryItemBody } from '@/features/cce-inventory/lib/types';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), post: vi.fn() } }));

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);

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

it('creates the equipment with the body it is given', async () => {
  const body: InventoryItemBody = {
    facility: { id: 'f1' },
    program: { id: 'p1' },
    catalogItem: {
      id: 'c1',
      fromPqsCatalog: false,
      type: 'Refrigerator',
      manufacturer: 'B Medical',
      model: 'TCW 40R',
      energySource: 'ELECTRIC',
      storageTemperature: 'PLUS4',
      archived: false,
    },
    equipmentTrackingId: 'SN-1',
    referenceName: 'Fridge 2',
    utilization: 'ACTIVE',
    yearOfInstallation: 2019,
    voltageStabilizer: 'YES',
    voltageRegulator: 'NO',
    backupGenerator: 'NO',
    manualTemperatureGauge: 'BUILD_IN',
    remoteTemperatureMonitor: 'NO_RTM',
    functionalStatus: 'FUNCTIONING',
  };
  post.mockResolvedValueOnce({ data: {} });

  await createInventoryItem(body);
  expect(post).toHaveBeenCalledWith('/inventoryItems', body);
});
