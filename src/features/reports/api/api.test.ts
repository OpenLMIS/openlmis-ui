import { expect, it, vi } from 'vitest';
import { fetchAvailableDashboards } from '@/features/reports/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

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
