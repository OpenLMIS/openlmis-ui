import { expect, it } from 'vitest';
import type { RequisitionCopy } from '@/features/requisitions/lib/offline-copies';
import { localPage, searchCopies } from '@/features/requisitions/lib/offline-search';
import type { RequisitionsQuery } from '@/features/requisitions/lib/types';

const query: RequisitionsQuery = {
  facility: 'f',
  page: 0,
  size: 1,
  sort: ['createdDate,asc', 'id'],
};
const copy = (id: string, createdDate: string, status = 'AUTHORIZED'): RequisitionCopy => ({
  id,
  userId: 'u',
  formatVersion: 1,
  generation: 0,
  revision: 1,
  fetchedAt: 1,
  summary: {
    id,
    emergency: false,
    status: status as RequisitionCopy['summary']['status'],
    createdDate,
    facility: { id: 'f' },
    program: { id: 'p' },
    processingPeriod: { id: 'period' },
  },
});
it('filters the complete set by inclusive deployment dates and status before sorting and paging', () => {
  const copies = [
    copy('late', '2026-11-04T04:59:59Z'),
    copy('wrong-status', '2026-11-03T12:00:00Z', 'APPROVED'),
    copy('early', '2026-11-03T05:00:00Z'),
    copy('next', '2026-11-04T05:00:00Z'),
  ];
  const rows = searchCopies(
    copies,
    {
      ...query,
      initiatedDateFrom: '2026-11-03',
      initiatedDateTo: '2026-11-03',
      requisitionStatus: 'AUTHORIZED',
    },
    'America/New_York',
  );
  expect(rows.map((row) => row.id)).toEqual(['early', 'late']);
  expect(localPage(rows, 1, 1)).toMatchObject({
    content: [copies[0]],
    totalElements: 2,
    totalPages: 2,
  });
});
it('breaks equal timestamp ties deterministically and preserves totals past the end', () => {
  const rows = searchCopies(
    [copy('b', '2026-11-03T10:00:00Z'), copy('a', '2026-11-03T10:00:00Z')],
    query,
    'UTC',
  );
  expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
  expect(localPage(rows, 2, 1)).toMatchObject({ content: [], totalElements: 2, totalPages: 2 });
});
it('sorts whole-second and fractional timestamps by time rather than their text', () => {
  const rows = searchCopies(
    [copy('fraction', '2026-11-03T10:00:00.1Z'), copy('whole', '2026-11-03T10:00:00Z')],
    query,
    'UTC',
  );
  expect(rows.map((row) => row.id)).toEqual(['whole', 'fraction']);
});

it('returns an empty page without reading saved access until an approval program is chosen', async () => {
  const { localApprovals } = await import('./offline-search');
  expect(await localApprovals({})).toMatchObject({ content: [], totalElements: 0 });
});
