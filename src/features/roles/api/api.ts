import type { Right, RightType, Role } from '@/features/reference-data/lib/types';
import type { RoleBody } from '@/features/roles/lib/role-form';
import { client } from '@/integrations/axios';

export async function fetchRole(id: string): Promise<Role> {
  const { data } = await client.get<Role>(`/roles/${id}`);
  return data;
}

export async function fetchRightsByType(type: RightType): Promise<Right[]> {
  const { data } = await client.get<Right[]>('/rights/search', { params: { type } });
  return data;
}

export async function createRole(role: RoleBody): Promise<Role> {
  const { data } = await client.post<Role>('/roles', role);
  return data;
}

/** Replaces the role whole; the server recomputes the rights of every user who holds it. */
export async function updateRole(id: string, role: RoleBody): Promise<Role> {
  const { data } = await client.put<Role>(`/roles/${id}`, role);
  return data;
}
