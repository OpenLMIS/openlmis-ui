import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStockCardSummaries, fetchStockOnHandReport } from '@/features/stock-on-hand/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

const get = vi.mocked(client.get);

beforeEach(() => get.mockReset());

describe('fetchStockCardSummaries', () => {
  it('reads one page of product summaries', async () => {
    const page = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 };
    get.mockResolvedValueOnce({ data: page });
    const query = {
      facilityId: 'f1',
      programId: 'p1',
      nonEmptyOnly: true,
      page: 0,
      size: 10,
      orderableCode: 'C1',
    } as const;

    await expect(fetchStockCardSummaries(query)).resolves.toEqual(page);
    expect(get).toHaveBeenCalledWith('/v2/stockCardSummaries', { params: query });
  });
});

describe('fetchStockOnHandReport', () => {
  it('reads the report as a file, with the unit and language', async () => {
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
    get.mockResolvedValueOnce({ data: pdf });

    await expect(
      fetchStockOnHandReport({ programId: 'p1', facilityId: 'f1', showInDoses: false, lang: 'pt' }),
    ).resolves.toBe(pdf);
    expect(get).toHaveBeenCalledWith('/stockCardSummaries/print', {
      params: { program: 'p1', facility: 'f1', showInDoses: false, lang: 'pt' },
      responseType: 'blob',
    });
  });

  it('reads a refusal sent as a file, so its message can be shown', async () => {
    const body = new Blob([JSON.stringify({ message: 'Permission check failed.' })], {
      type: 'application/json',
    });
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: body,
    });
    get.mockRejectedValueOnce(error);

    await expect(
      fetchStockOnHandReport({ programId: 'p1', facilityId: 'f1', showInDoses: true, lang: 'en' }),
    ).rejects.toMatchObject({
      response: { status: 403, data: { message: 'Permission check failed.' } },
    });
  });
});
