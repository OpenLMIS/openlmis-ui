import type {
  RequisitionGroup,
  RequisitionGroupBody,
  RequisitionGroupsSearch,
} from '@/features/requisition-groups/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function searchRequisitionGroups(
  body: RequisitionGroupsSearch,
  { page, size }: { page: number; size: number },
): Promise<Page<RequisitionGroup>> {
  const { data } = await client.post<Page<RequisitionGroup>>('/requisitionGroups/search', body, {
    params: { page, size },
  });
  return data;
}

export async function createRequisitionGroup(body: RequisitionGroupBody) {
  const { data } = await client.post<RequisitionGroup>('/requisitionGroups', body);
  return data;
}

export async function updateRequisitionGroup(id: string, body: RequisitionGroupBody) {
  const { data } = await client.put<RequisitionGroup>(`/requisitionGroups/${id}`, body);
  return data;
}
