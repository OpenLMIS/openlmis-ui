import { queryOptions } from '@tanstack/react-query';
import { fetchSupplyPartner, fetchSupplyPartners } from '@/features/supply-partners/api/api';
import type { SupplyPartnersQuery } from '@/features/supply-partners/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const supplyPartnersOptions = (query: SupplyPartnersQuery) =>
  queryOptions({
    queryKey: queryKeys.supplyPartners.list(query),
    queryFn: () => fetchSupplyPartners(query),
  });

export const supplyPartnerOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.supplyPartners.detail(id),
    queryFn: () => fetchSupplyPartner(id),
  });
