import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFacilityType,
  fetchFacilityType,
  fetchFacilityTypesPage,
  updateFacilityType,
} from '@/features/facility-types/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);
const put = vi.mocked(client.put);

const healthCenter = {
  id: 'ft3',
  code: 'health_center',
  name: 'Health Center',
  description: 'Kept as it is',
  displayOrder: 3,
  active: true,
  primaryHealthCare: true,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchFacilityTypesPage', () => {
  it('asks the server for one sorted page', async () => {
    const page = { content: [healthCenter], totalElements: 1, totalPages: 1 };
    get.mockResolvedValueOnce({ data: page });

    const query = { page: 1, size: 20, sort: 'displayOrder,asc' };
    await expect(fetchFacilityTypesPage(query)).resolves.toEqual(page);
    expect(get).toHaveBeenCalledWith('/facilityTypes', { params: query });
  });
});

describe('fetchFacilityType', () => {
  it('reads one type', async () => {
    get.mockResolvedValueOnce({ data: healthCenter });

    await expect(fetchFacilityType('ft3')).resolves.toEqual(healthCenter);
    expect(get).toHaveBeenCalledWith('/facilityTypes/ft3');
  });
});

describe('createFacilityType', () => {
  it('posts the new type', async () => {
    const { id: _id, description: _description, ...body } = healthCenter;
    post.mockResolvedValueOnce({ data: healthCenter });

    await expect(createFacilityType(body)).resolves.toEqual(healthCenter);
    expect(post).toHaveBeenCalledWith('/facilityTypes', body);
  });
});

describe('updateFacilityType', () => {
  it('puts the whole type at its id', async () => {
    put.mockResolvedValueOnce({ data: healthCenter });

    await expect(updateFacilityType('ft3', healthCenter)).resolves.toEqual(healthCenter);
    expect(put).toHaveBeenCalledWith('/facilityTypes/ft3', healthCenter);
  });
});
