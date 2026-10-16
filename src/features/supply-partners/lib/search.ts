import { z } from 'zod';
import type { SupplyPartnersQuery } from '@/features/supply-partners/lib/types';
import { tableSearchSchema, toPaginationState } from '@/lib/table-search';

export const supplyPartnersSearchSchema = tableSearchSchema(['name'])
  .omit({ sort: true, dir: true })
  .extend({ partner: z.literal('new').optional().catch(undefined) });

export type SupplyPartnersSearch = z.infer<typeof supplyPartnersSearchSchema>;

export function toSupplyPartnersQuery(search: SupplyPartnersSearch): SupplyPartnersQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return { page: pageIndex, size: pageSize };
}

export function matchesNameOrCode(item: { name: string | null; code: string }, search: string) {
  const text = search.toLowerCase();
  return (item.name ?? '').toLowerCase().includes(text) || item.code.toLowerCase().startsWith(text);
}
