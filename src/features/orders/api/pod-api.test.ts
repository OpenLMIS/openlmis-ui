import { beforeEach, expect, it, vi } from 'vitest';
import {
  fetchProofOfDelivery,
  fetchProofOfDeliveryPdf,
  findProofOfDelivery,
  saveProofOfDelivery,
} from '@/features/orders/api/api';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), put: vi.fn() } }));
vi.mock('@/lib/fetch-report', () => ({ fetchReport: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('expands the detail and takes only the first POD from an order lookup, including no match', async () => {
  vi.mocked(client.get)
    .mockResolvedValueOnce({ data: { id: 'pod' } })
    .mockResolvedValueOnce({ data: { content: [{ id: 'first' }, { id: 'second' }] } })
    .mockResolvedValueOnce({ data: { content: [] } });
  expect(await fetchProofOfDelivery('pod')).toEqual({ id: 'pod' });
  expect(client.get).toHaveBeenCalledWith('/proofsOfDelivery/pod', {
    params: { expand: 'shipment.order' },
  });
  expect(await findProofOfDelivery('order')).toEqual({ id: 'first' });
  expect(client.get).toHaveBeenCalledWith('/proofsOfDelivery', { params: { orderId: 'order' } });
  expect(await findProofOfDelivery('missing')).toBeNull();
});
it('sends the writable body and uses the shared PDF transport', async () => {
  const body = {
    shipment: { id: 's' },
    status: 'INITIATED' as const,
    receivedBy: '',
    deliveredBy: '',
    receivedDate: '',
    lineItems: [],
  };
  vi.mocked(client.put).mockResolvedValue({ data: { id: 'pod', ...body } });
  expect(await saveProofOfDelivery('pod', body)).toEqual({ id: 'pod', ...body });
  expect(client.put).toHaveBeenCalledWith('/proofsOfDelivery/pod', body);
  fetchProofOfDeliveryPdf('pod', 'ar');
  expect(fetchReport).toHaveBeenCalledWith('/proofsOfDelivery/pod/print', {
    format: 'pdf',
    lang: 'ar',
  });
});
