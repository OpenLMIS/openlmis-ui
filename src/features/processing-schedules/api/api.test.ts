import { expect, it, vi } from 'vitest';
import { fetchLatestPeriod } from '@/features/processing-schedules/api/api';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

it('reads the latest period by start date with its total count', async () => {
  const page = { content: [{ endDate: '2026-01-31' }], totalElements: 11 };
  vi.mocked(client.get).mockResolvedValueOnce({ data: page });
  await expect(fetchLatestPeriod('s1')).resolves.toEqual(page);
  expect(client.get).toHaveBeenCalledWith('/processingPeriods', {
    params: { processingScheduleId: 's1', page: 0, size: 1, sort: 'startDate,desc' },
  });
});
