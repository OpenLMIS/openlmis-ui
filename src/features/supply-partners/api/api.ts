import type { QueryClient } from '@tanstack/react-query';
import { facilityTypeApprovedOrderablesOptions } from '@/features/reference-data/api/queries';
import type { Facility } from '@/features/reference-data/lib/types';
import { pruneAssociationProducts } from '@/features/supply-partners/lib/association';
import {
  canonicalSupplyPartner,
  toSupplyPartnerBody,
} from '@/features/supply-partners/lib/supply-partner-form';
import type {
  AssociationDraft,
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

export async function removeSupplyPartnerFacility(
  queryClient: QueryClient,
  association: AssociationDraft,
  facilityId: string,
  facilities: readonly Pick<Facility, 'id' | 'type'>[],
  programCode: string,
  facilityLookupReady: boolean,
) {
  const scope = getSessionScope();
  assertSessionScope(scope);
  if (!facilityLookupReady) throw new Error('Selected facilities have not been resolved');
  const remaining = association.facilityIds.filter((id) => id !== facilityId);
  if (!remaining.length) return pruneAssociationProducts(association, [], []);
  const unresolved = remaining.some((id) => !facilities.some((facility) => facility.id === id));
  if (unresolved) {
    if (facilities.some((facility) => facility.id === facilityId))
      throw new Error('A remaining selected facility is unavailable');
    return {
      association: { ...association, facilityIds: remaining },
      removedOrderableIds: [],
    };
  }
  const types = remaining.map((id) => {
    const facility = facilities.find((item) => item.id === id);
    if (!facility) throw new Error('A selected facility is unavailable');
    return facility.type.code;
  });
  const approved = await queryClient.fetchQuery({
    ...facilityTypeApprovedOrderablesOptions({ facilityTypeCodes: types, programCode }),
    staleTime: 0,
  });
  assertSessionScope(scope);
  return pruneAssociationProducts(
    association,
    remaining,
    approved.map(({ id }) => id),
  );
}
