import { expect, it, vi } from 'vitest';
import {
  fetchAvailableDashboards,
  fetchParameterOptions,
  fetchTemplateReport,
  fetchTemplateReports,
} from '@/features/reports/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn(), post: vi.fn() } }));

it('refuses incomplete dashboard discovery rather than paging rights-filtered results again', async () => {
  vi.mocked(client.get).mockResolvedValue({
    data: {
      content: [{ id: 'one', name: 'One' }],
      totalElements: 2,
      totalPages: 2,
      number: 0,
      size: 1,
    },
  });
  await expect(fetchAvailableDashboards()).rejects.toThrow();
  expect(client.get).toHaveBeenCalledOnce();
  expect(client.get).toHaveBeenCalledWith(
    '/reports/dashboardReports/availableReports',
    expect.objectContaining({ params: { size: 0, showOnHomePage: false } }),
  );
});

it('drops compiled templates from list and detail before they reach the cache', async () => {
  vi.mocked(client.get).mockResolvedValueOnce({
    data: [{ id: 'r1', name: 'Stock On Hand', data: 'compiled SQL' }],
  });
  expect(await fetchTemplateReports('common')).toEqual([{ id: 'r1', name: 'Stock On Hand' }]);
  vi.mocked(client.get).mockResolvedValueOnce({
    data: { id: 'r1', name: 'Stock On Hand', data: 'compiled SQL', templateParameters: [] },
  });
  expect(await fetchTemplateReport('common', 'r1')).toEqual({
    id: 'r1',
    name: 'Stock On Hand',
    templateParameters: [],
  });
});

it('sends a parent value as a query param and the zone search as a POST body', async () => {
  vi.mocked(client.get).mockResolvedValue({ data: [] });
  vi.mocked(client.post).mockResolvedValue({ data: { content: [], totalElements: 0 } });
  await fetchParameterOptions({ method: 'GET', path: '/processingPeriods' }, { programId: 'a&b' });
  expect(client.get).toHaveBeenCalledWith(
    '/processingPeriods',
    expect.objectContaining({ params: { programId: 'a&b' } }),
  );
  await fetchParameterOptions(
    { method: 'POST', path: '/geographicZones/search', body: { levelNumber: '2' } },
    {},
  );
  expect(client.post).toHaveBeenCalledWith(
    '/geographicZones/search',
    { levelNumber: '2' },
    expect.objectContaining({ params: {} }),
  );
});
