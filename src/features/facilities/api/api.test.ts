import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFacility, fetchFacilitiesPage, updateFacility } from '@/features/facilities/api/api';
import type { FacilityBody } from '@/features/facilities/lib/types';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const post = vi.mocked(client.post);
const put = vi.mocked(client.put);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchFacilitiesPage', () => {
  it('sends the filters in the body and the paging and sort as params, as legacy does', async () => {
    const page = { content: [], totalElements: 0, totalPages: 0 };
    post.mockResolvedValueOnce({ data: page });

    await expect(
      fetchFacilitiesPage({ page: 1, size: 10, sort: 'name,asc', name: 'Comfort', zoneId: 'z1' }),
    ).resolves.toEqual(page);
    expect(post).toHaveBeenCalledWith(
      '/facilities/search',
      { name: 'Comfort', zoneId: 'z1' },
      { params: { page: 1, size: 10, sort: 'name,asc' } },
    );
  });

  it('leaves out the filters that are not set', async () => {
    post.mockResolvedValueOnce({ data: { content: [], totalElements: 0, totalPages: 0 } });

    await fetchFacilitiesPage({ page: 0, size: 10, sort: 'name,asc' });
    expect(post).toHaveBeenCalledWith(
      '/facilities/search',
      {},
      { params: { page: 0, size: 10, sort: 'name,asc' } },
    );
  });
});

describe('createFacility', () => {
  it('posts the facility with its programs in one request', async () => {
    const body: FacilityBody = {
      code: 'HC01',
      name: 'Comfort Health Clinic',
      description: null,
      active: true,
      enabled: true,
      goLiveDate: '2026-10-01',
      type: { id: 't1' },
      geographicZone: { id: 'z1' },
      operator: null,
      supportedPrograms: [
        {
          id: 'p1',
          code: 'PRG001',
          supportActive: true,
          supportLocallyFulfilled: false,
          supportStartDate: '2026-10-01',
        },
      ],
    };
    post.mockResolvedValueOnce({ data: { id: 'f1', ...body } });

    await createFacility(body);
    expect(post).toHaveBeenCalledWith('/facilities', body);
  });
});

describe('updateFacility', () => {
  it('puts the whole facility back at its id', async () => {
    const body = { id: 'f1', code: 'HC01', name: 'Comfort' } as unknown as FacilityBody;
    put.mockResolvedValueOnce({ data: body });

    await updateFacility('f1', body);
    expect(put).toHaveBeenCalledWith('/facilities/f1', body);
  });
});
