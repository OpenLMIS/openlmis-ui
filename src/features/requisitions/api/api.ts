import type {
  RequisitionRecord,
  RequisitionSearchResult,
  RequisitionStatusMessage,
  RequisitionsQuery,
} from '@/features/requisitions/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import type { Page } from '@/lib/types';

export async function searchRequisitions(params: RequisitionsQuery) {
  const { data } = await client.get<Page<RequisitionSearchResult>>('/requisitions/search', {
    params,
    paramsSerializer: { indexes: null },
  });
  return data;
}

export async function fetchRequisition(id: string) {
  const { data } = await client.get<RequisitionRecord>(`/v2/requisitions/${id}`);
  return data;
}
export async function fetchStatusMessages(id: string) {
  const { data } = await client.get<RequisitionStatusMessage[]>(
    `/requisitions/${id}/statusMessages`,
  );
  return data;
}
export function fetchRequisitionReport(id: string, params: { showInDoses: boolean; lang: string }) {
  return fetchReport(`/requisitions/${id}/print`, params);
}
