import type {
  ColumnDefinition,
  NewRequisitionTemplate,
  RequisitionTemplate,
} from '@/features/requisition-templates/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchRequisitionTemplates(): Promise<RequisitionTemplate[]> {
  const { data } = await client.get<RequisitionTemplate[]>('/requisitionTemplates');
  return data;
}

export async function fetchAvailableColumns(): Promise<ColumnDefinition[]> {
  const { data } = await client.get<Page<ColumnDefinition>>('/availableRequisitionColumns');
  return data.content;
}

export async function createRequisitionTemplate(
  body: NewRequisitionTemplate,
): Promise<RequisitionTemplate> {
  const { data } = await client.post<RequisitionTemplate>('/requisitionTemplates', body);
  return data;
}
