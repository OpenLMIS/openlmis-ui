import { beforeEach, expect, it, vi } from 'vitest';
import {
  fetchGeographicZoneChildren,
  fetchGeographicZonesPage,
} from '@/features/geographic-zones/api/api';
import {
  geographicZonesSearchSchema,
  toGeographicZonesQuery,
} from '@/features/geographic-zones/lib/search';
import { client } from '@/integrations/axios';

vi.mock('@/integrations/axios', () => ({ client: { post: vi.fn() } }));
const post = vi.mocked(client.post);
const parent = '7179c195-b59a-4c24-8747-d56e2d786baa';

beforeEach(() => {
  vi.resetAllMocks();
  post.mockResolvedValue({ data: { content: [], totalElements: 0 } });
});

it('keeps filters in the search body, omits blank filters, preserves level zero and always pages the list', async () => {
  await fetchGeographicZonesPage(
    toGeographicZonesQuery(
      geographicZonesSearchSchema.parse({
        name: '  ',
        code: '',
        parent: '',
        levelNumber: Number.POSITIVE_INFINITY,
      }),
    ),
  );
  expect(post).toHaveBeenLastCalledWith(
    '/geographicZones/search',
    {},
    {
      params: { page: 0, size: 10, sort: 'name' },
    },
  );

  await fetchGeographicZonesPage(
    toGeographicZonesQuery(
      geographicZonesSearchSchema.parse({
        name: '  Nampula ',
        code: ' DIST ',
        parent,
        levelNumber: 0,
        page: 3,
        size: 25,
        sort: 'code',
        dir: 'desc',
      }),
    ),
  );
  expect(post).toHaveBeenLastCalledWith(
    '/geographicZones/search',
    {
      name: 'Nampula',
      code: 'DIST',
      parent,
      levelNumber: 0,
    },
    { params: { page: 2, size: 25, sort: 'name' } },
  );

  await fetchGeographicZoneChildren(parent);
  expect(post).toHaveBeenLastCalledWith(
    '/geographicZones/search',
    { parent },
    {
      params: { sort: 'name' },
    },
  );
});
