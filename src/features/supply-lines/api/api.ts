import type {
  SupplyLine,
  SupplyLineNamedReference,
  SupplyLinesQuery,
} from '@/features/supply-lines/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

type SupplyLineMembership = {
  supervisoryNode?: {
    requisitionGroup?: {
      memberFacilities?: SupplyLineNamedReference[] | null;
    } | null;
  } | null;
};

export async function fetchSupplyLinesPage({
  page,
  size,
  sort,
  supplyingFacilityId,
  programId,
}: SupplyLinesQuery) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  params.append('sort', sort);
  params.append('sort', 'id,asc');
  params.append('expand', 'supervisoryNode');
  params.append('expand', 'supplyingFacility');
  params.append('expand', 'program');
  if (supplyingFacilityId) params.set('supplyingFacilityId', supplyingFacilityId);
  if (programId) params.set('programId', programId);

  const { data } = await client.get<Page<SupplyLine>>('/supplyLines', { params });
  return data;
}

export async function fetchSupplyLine(id: string) {
  const { data } = await client.get<SupplyLine>(`/supplyLines/${id}`);
  return data;
}

export async function fetchServedFacilities(nodeId: string) {
  const params = new URLSearchParams({
    supervisoryNodeId: nodeId,
    page: '0',
    size: '1',
    expand: 'supervisoryNode.requisitionGroup.memberFacilities',
  });
  const { data } = await client.get<Page<SupplyLineMembership>>('/supplyLines', { params });
  return data.content[0]?.supervisoryNode?.requisitionGroup?.memberFacilities ?? [];
}
