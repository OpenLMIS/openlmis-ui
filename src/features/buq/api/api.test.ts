import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  BuqMovedError,
  deleteBuq,
  downloadBuq,
  fetchBuqPeriods,
  fetchOpenBuqs,
  fetchTakenPeriods,
  finalApproveBuqs,
  prepareBuq,
} from '@/features/buq/api/api';
import { client } from '@/integrations/axios';
import { SessionEndedError } from '@/lib/session-scope';

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

describe('fetchOpenBuqs', () => {
  it('reads every page of the open facility forecasts in a stable order', async () => {
    get
      .mockResolvedValueOnce(page([{ id: 'b1' }], 2))
      .mockResolvedValueOnce(page([{ id: 'b2' }], 2));

    await expect(fetchOpenBuqs('f1')).resolves.toEqual([{ id: 'b1' }, { id: 'b2' }]);
    expect(get).toHaveBeenNthCalledWith(1, '/bottomUpQuantifications', {
      params: {
        facility: 'f1',
        status: ['DRAFT', 'SUBMITTED', 'REJECTED'],
        page: 0,
        size: 100,
        sort: 'id,asc',
      },
      paramsSerializer: { indexes: null },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/bottomUpQuantifications', {
      params: {
        facility: 'f1',
        status: ['DRAFT', 'SUBMITTED', 'REJECTED'],
        page: 1,
        size: 100,
        sort: 'id,asc',
      },
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

describe('fetchTakenPeriods', () => {
  it('reads the facility forecasts in every status', async () => {
    vi.mocked(client.get).mockResolvedValueOnce(page([{ id: 'b1', processingPeriodId: 'p1' }], 1));

    await expect(fetchTakenPeriods('f1')).resolves.toEqual([
      { id: 'b1', processingPeriodId: 'p1' },
    ]);
    expect(get).toHaveBeenCalledWith('/bottomUpQuantifications', {
      params: { facility: 'f1', page: 0, size: 100, sort: 'id,asc' },
    });
  });
});

describe('deleteBuq', () => {
  it('deletes a forecast still waiting at the facility', async () => {
    get.mockResolvedValueOnce({ data: { status: 'SUBMITTED' } });
    vi.mocked(client.delete).mockResolvedValueOnce({});

    await deleteBuq('b1');

    expect(get).toHaveBeenCalledWith('/bottomUpQuantifications/b1');
    expect(client.delete).toHaveBeenCalledWith('/bottomUpQuantifications/b1');
  });

  it('refuses a forecast that has moved on in the approval process', async () => {
    get.mockResolvedValueOnce({ data: { status: 'AUTHORIZED' } });

    await expect(deleteBuq('b1')).rejects.toBeInstanceOf(BuqMovedError);
    expect(client.delete).not.toHaveBeenCalled();
  });
});

describe('downloadBuq', () => {
  it('reads the forecast CSV as a file', async () => {
    const csv = new Blob(['csv']);
    get.mockResolvedValueOnce({ data: csv });

    await expect(downloadBuq('b1')).resolves.toBe(csv);
    expect(get).toHaveBeenCalledWith('/bottomUpQuantifications/b1/download', {
      params: undefined,
      responseType: 'blob',
    });
  });
});

describe('finalApproveBuqs', () => {
  const ids = Array.from({ length: 150 }, (_, index) => `b${index}`);

  it('approves the ids in batches of 100, one request at a time', async () => {
    post.mockResolvedValue({ data: [] });

    await expect(finalApproveBuqs(ids)).resolves.toEqual({ approved: ids, error: undefined });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenNthCalledWith(1, '/bottomUpQuantifications/finalApprove', null, {
      params: { id: ids.slice(0, 100) },
      paramsSerializer: { indexes: null },
    });
    expect(post.mock.calls[1]?.[2]).toEqual({
      params: { id: ids.slice(100) },
      paramsSerializer: { indexes: null },
    });
  });

  it('reports the batches already approved when a later one fails', async () => {
    const refused = new Error('refused');
    post.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(refused);

    await expect(finalApproveBuqs(ids)).resolves.toEqual({
      approved: ids.slice(0, 100),
      error: refused,
    });
  });

  it('stops before the next batch when another user signs in', async () => {
    post.mockImplementationOnce(async () => {
      useLoginData.setState({ referenceDataUserId: 'someone-else' });
      return { data: [] };
    });

    const result = await finalApproveBuqs(ids);

    expect(post).toHaveBeenCalledTimes(1);
    expect(result.error).toBeInstanceOf(SessionEndedError);
  });

  it('fails outright when nothing was approved', async () => {
    post.mockRejectedValueOnce(new Error('refused'));

    await expect(finalApproveBuqs(ids)).rejects.toThrow('refused');
  });
});
