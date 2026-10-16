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

export const supplyPartnerEditSearchSchema = tableSearchSchema(['name'])
  .omit({ sort: true, dir: true })
  .extend({
    association: z.string().min(1).optional().catch(undefined),
    products: z.literal(true).optional().catch(undefined),
    view: z.enum(['facilities', 'products']).optional().catch(undefined),
    viewAssociation: z.string().optional().catch(undefined),
    listPage: z.number().int().min(1).optional().catch(undefined),
    listSize: z.number().int().min(1).max(100).optional().catch(undefined),
  });
export type SupplyPartnerEditSearch = z.infer<typeof supplyPartnerEditSearchSchema>;
export const supplyPartnerListSearch = (search: SupplyPartnerEditSearch): SupplyPartnersSearch => ({
  page: search.listPage,
  size: search.listSize,
});
