import { expect, it, vi } from 'vitest';
import { searchRequisitions } from '@/features/requisitions/api/api';
import {
  requisitionSearchSchema,
  toRequisitionQuery,
} from '@/features/requisitions/lib/search-facilities';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { get: vi.fn() } }));

it('maps URL filters to legacy parameters and always sends size and stable sorting', async () => {
  vi.mocked(client.get).mockResolvedValue({ data: { content: [] } });
  await searchRequisitions(
    toRequisitionQuery({
      ...requisitionSearchSchema.parse({
        facility: 'f',
        program: 'p',
        status: 'AUTHORIZED',
        initiatedFrom: '2026-01-01',
        initiatedTo: '2026-02-01',
        page: 3,
        dir: 'asc',
      }),
      facility: 'f',
    }),
  );
  expect(client.get).toHaveBeenCalledWith('/requisitions/search', {
    paramsSerializer: { indexes: null },
    params: {
      facility: 'f',
      program: 'p',
      requisitionStatus: 'AUTHORIZED',
      initiatedDateFrom: '2026-01-01',
      initiatedDateTo: '2026-02-01',
      page: 2,
      size: 10,
      sort: ['createdDate,asc', 'id'],
    },
  });
});
