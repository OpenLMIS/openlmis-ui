import type { RequisitionSearchResult, RequisitionsQuery } from '@/features/requisitions/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function searchRequisitions(params: RequisitionsQuery) {
  const { data } = await client.get<Page<RequisitionSearchResult>>('/requisitions/search', {
    params,
    paramsSerializer: { indexes: null },
  });
  return data;
}
