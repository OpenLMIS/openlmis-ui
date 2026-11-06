import { beforeEach, expect, it, vi } from 'vitest';
import {
  dismissAlert,
  fetchCatalogItems,
  fetchInventoryAlerts,
  fetchInventoryItems,
  transferInventoryItem,
} from '@/features/cce-inventory/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), put: vi.fn() } }));

const get = vi.mocked(client.get);
const put = vi.mocked(client.put);

beforeEach(() => {
  get.mockReset();
  put.mockReset();
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

it('dismisses the whole alert and transfers through its own endpoint, as legacy', async () => {
  const alert = {
    alert_id: 'a1',
    device_id: 'fridge',
    start_ts: '2026-11-01T10:00:00Z',
    end_ts: null,
    dismissed: false,
    status: { 'en-US': 'Too warm' },
  };
  await dismissAlert(alert);
  await transferInventoryItem('fridge', {
    facilityId: 'f2',
    programId: 'p',
    yearOfInstallation: 2019,
  });

  expect(put).toHaveBeenNthCalledWith(1, '/cceAlerts', { ...alert, dismissed: true });
  expect(put).toHaveBeenNthCalledWith(2, '/inventoryItems/fridge/transfer', {
    id: 'fridge',
    facilityId: 'f2',
    programId: 'p',
    yearOfInstallation: 2019,
  });
});
