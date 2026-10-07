import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStockCard, fetchStockCardReport } from '@/features/stock-card/api/api';
import { client } from '@/integrations/axios';
import { httpError } from '@/tests/http-error';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));
const get = vi.mocked(client.get);
beforeEach(() => get.mockReset());

describe('stock card API', () => {
  it('reads the whole card from the released endpoint without paging parameters', async () => {
    const card = { id: 'card1', lineItems: [] };
    get.mockResolvedValueOnce({ data: card });
    await expect(fetchStockCard('card1')).resolves.toBe(card);
    expect(get).toHaveBeenCalledWith('/stockCards/card1');
  });

  it('reads the PDF with unit and language through the authenticated client', async () => {
    const pdf = new Blob(['%PDF']);
    get.mockResolvedValueOnce({ data: pdf });
    await expect(fetchStockCardReport('card1', { showInDoses: false, lang: 'ar' })).resolves.toBe(
      pdf,
    );
    expect(get).toHaveBeenCalledWith('/stockCards/card1/print', {
      params: { showInDoses: false, lang: 'ar' },
      responseType: 'blob',
    });
  });

  it('reads an error returned as a blob', async () => {
    get.mockRejectedValueOnce(httpError(403, new Blob(['{"message":"No access"}'])));
    await expect(
      fetchStockCardReport('card1', { showInDoses: true, lang: 'en' }),
    ).rejects.toMatchObject({ response: { status: 403, data: { message: 'No access' } } });
  });
});
