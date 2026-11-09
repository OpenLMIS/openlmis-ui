import { expect, it, vi } from 'vitest';
import { client } from '@/integrations/axios';
import { fetchReportFile } from '@/lib/fetch-report';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

it('keeps the server filename from an unquoted order export header', async () => {
  const blob = new Blob(['csv']);
  vi.mocked(client.get).mockResolvedValue({
    data: blob,
    headers: { 'content-disposition': 'attachment; filename=OORDER-X.csv' },
  });
  expect(await fetchReportFile('/orders/x/export', { type: 'csv' })).toEqual({
    blob,
    filename: 'OORDER-X.csv',
  });
});
