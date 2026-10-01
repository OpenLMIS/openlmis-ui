import type {
  Facility,
  FacilityOperator,
  FacilityType,
  GeographicZone,
  MinimalFacility,
  Program,
  Role,
  SupervisoryNode,
} from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

/** Every facility in one request; the endpoint is meant for pickers and has no paging worth using. */
export async function fetchMinimalFacilities(): Promise<MinimalFacility[]> {
  const { data } = await client.get<Page<MinimalFacility>>('/facilities/minimal');
  return data.content;
}

/** One facility, for showing its name without loading every facility. */
export async function fetchFacility(id: string): Promise<Facility> {
  const { data } = await client.get<Facility>(`/facilities/${id}`);
  return data;
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await client.get<Role[]>('/roles');
  return data;
}

export async function fetchPrograms(): Promise<Program[]> {
  const { data } = await client.get<Program[]>('/programs');
  return data;
}

/** Every node; without paging params the endpoint returns them all. */
export async function fetchSupervisoryNodes(): Promise<SupervisoryNode[]> {
  const { data } = await client.get<Page<SupervisoryNode>>('/supervisoryNodes');
  return data.content;
}

export async function fetchFacilityTypes(
  filter: { active?: boolean } = {},
): Promise<FacilityType[]> {
  const { data } = await client.get<Page<FacilityType>>('/facilityTypes', { params: filter });
  return data.content;
}

/** Every zone, sorted by the server; without paging params the endpoint returns them all. */
export async function fetchGeographicZones(): Promise<GeographicZone[]> {
  const { data } = await client.get<Page<GeographicZone>>('/geographicZones', {
    params: { sort: 'name,asc' },
  });
  return data.content;
}

export async function fetchFacilityOperators(): Promise<FacilityOperator[]> {
  const { data } = await client.get<FacilityOperator[]>('/facilityOperators');
  return data;
}
