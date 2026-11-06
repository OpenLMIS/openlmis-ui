import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBuqPeriods, fetchPreparedBuqs, prepareBuq } from '@/features/buq/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({
  client: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);

const page = <T>(content: T[], totalPages: number) => ({
  data: { content, totalPages, totalElements: content.length, number: 0, size: 100 },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchPreparedBuqs', () => {
  it('reads every page of the facility forecasts that can still be prepared again', async () => {
    get
      .mockResolvedValueOnce(page([{ id: 'b1' }], 2))
      .mockResolvedValueOnce(page([{ id: 'b2' }], 2));

    await expect(fetchPreparedBuqs('f1')).resolves.toEqual([{ id: 'b1' }, { id: 'b2' }]);
    expect(get).toHaveBeenNthCalledWith(1, '/bottomUpQuantifications', {
      params: { facility: 'f1', status: ['DRAFT', 'SUBMITTED', 'REJECTED'], page: 0, size: 100 },
      paramsSerializer: { indexes: null },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/bottomUpQuantifications', {
      params: { facility: 'f1', status: ['DRAFT', 'SUBMITTED', 'REJECTED'], page: 1, size: 100 },
      paramsSerializer: { indexes: null },
    });
  });
});

describe('fetchBuqPeriods', () => {
  it('asks the server for the periods of the BUQ schedule only', async () => {
    get.mockResolvedValueOnce(page([{ id: 'p1' }], 1));

    await expect(fetchBuqPeriods('s1')).resolves.toEqual([{ id: 'p1' }]);
    expect(get).toHaveBeenCalledWith('/processingPeriods', {
      params: { processingScheduleId: 's1', page: 0, size: 100, sort: 'startDate,asc' },
    });
  });
});

describe('prepareBuq', () => {
  it('prepares a forecast for the facility, program and period', async () => {
    post.mockResolvedValueOnce({ data: { id: 'b1' } });

    await expect(
      prepareBuq({ facilityId: 'f1', programId: 'g1', processingPeriodId: 'p1' }),
    ).resolves.toEqual({ id: 'b1' });
    expect(post).toHaveBeenCalledWith('/bottomUpQuantifications/prepare', null, {
      params: { facilityId: 'f1', programId: 'g1', processingPeriodId: 'p1' },
    });
  });
});
