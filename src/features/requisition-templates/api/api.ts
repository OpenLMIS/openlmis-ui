import {
  applyDraft,
  type TemplateDraft,
} from '@/features/requisition-templates/lib/template-draft';
import type {
  ColumnDefinition,
  NewRequisitionTemplate,
  RequisitionTemplate,
} from '@/features/requisition-templates/lib/types';
import { client } from '@/integrations/axios';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
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

export class ReplacedTemplateError extends Error {
  constructor() {
    super();
    this.name = 'ReplacedTemplateError';
  }
}

export async function fetchRequisitionTemplate(id: string): Promise<RequisitionTemplate> {
  const { data } = await client.get<RequisitionTemplate>(`/requisitionTemplates/${id}`);
  return data;
}

export async function fetchReasonTags(): Promise<string[]> {
  const { data } = await client.get<string[]>('/stockCardLineItemReasonTags');
  return data.toSorted((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export async function saveRequisitionTemplate(
  id: string,
  draft: TemplateDraft,
): Promise<RequisitionTemplate> {
  const scope = getSessionScope();
  const latest = await fetchRequisitionTemplate(id);
  assertSessionScope(scope);
  if (!latest.program?.id) throw new ReplacedTemplateError();
  const { data } = await client.put<RequisitionTemplate>(
    `/requisitionTemplates/${id}`,
    applyDraft(latest, draft),
  );
  return data;
}
