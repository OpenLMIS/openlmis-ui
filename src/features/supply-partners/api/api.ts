import {
  canonicalSupplyPartner,
  toSupplyPartnerBody,
} from '@/features/supply-partners/lib/supply-partner-form';
import type {
  SupplyPartner,
  SupplyPartnerDraft,
  SupplyPartnersQuery,
} from '@/features/supply-partners/lib/types';
import { client } from '@/integrations/axios';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

export async function fetchSupplyPartners({ page, size }: SupplyPartnersQuery) {
  const { data } = await client.get<Page<SupplyPartner>>('/supplyPartners', {
    params: { page, size },
  });
  return data;
}

export async function fetchSupplyPartner(id: string) {
  const { data } = await client.get<SupplyPartner>(`/supplyPartners/${id}`);
  return data;
}

export async function createSupplyPartner({ code, name }: { code: string; name: string }) {
  const { data } = await client.post<SupplyPartner>('/supplyPartners', {
    code,
    name,
    associations: [],
  });
  return data;
}

export class SupplyPartnerConflictError extends Error {
  constructor() {
    super('The supply partner changed since it was opened');
    this.name = 'SupplyPartnerConflictError';
  }
}

export async function saveSupplyPartner(saved: SupplyPartner, draft: SupplyPartnerDraft) {
  const scope = getSessionScope();
  assertSessionScope(scope);
  const body = toSupplyPartnerBody(saved, draft);
  const baseline = canonicalSupplyPartner(saved);
  if (canonicalSupplyPartner(body) === baseline) return null;
  const latest = await fetchSupplyPartner(saved.id);
  assertSessionScope(scope);
  if (canonicalSupplyPartner(latest) !== baseline) throw new SupplyPartnerConflictError();
  const { data } = await client.put<SupplyPartner>(`/supplyPartners/${saved.id}`, body);
  assertSessionScope(scope);
  return data;
}
