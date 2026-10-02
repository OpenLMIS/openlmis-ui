import type {
  AssignmentBody,
  AssignmentsQuery,
  SavedAssignment,
} from '@/components/valid-assignments/types';
import type { ValidSource } from '@/features/valid-sources/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchValidSources(query: AssignmentsQuery) {
  const { data } = await client.get<Page<ValidSource>>('/validSources', {
    params: query,
    paramsSerializer: { indexes: null },
  });
  return data;
}

/** The server answers 200 with the one it already had for the same program, type and node. */
export async function createValidSource(body: AssignmentBody): Promise<SavedAssignment> {
  const { data, status } = await client.post<ValidSource>('/validSources', body);
  return { assignment: data, created: status === 201 };
}

export async function deleteValidSource(id: string) {
  await client.delete(`/validSources/${id}`);
}
