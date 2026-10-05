import type {
  AssignmentBody,
  AssignmentsQuery,
  SavedAssignment,
  ValidAssignment,
} from '@/components/valid-assignments/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchValidSources(query: AssignmentsQuery) {
  const { data } = await client.get<Page<ValidAssignment>>('/validSources', {
    params: query,
    paramsSerializer: { indexes: null },
  });
  return data;
}

/** The server answers 200 with the one it already had for the same program, type and node. */
export async function createValidSource(body: AssignmentBody): Promise<SavedAssignment> {
  const { data, status } = await client.post<ValidAssignment>('/validSources', body);
  return { assignment: data, created: status === 201 };
}

export async function deleteValidSource(id: string) {
  await client.delete(`/validSources/${id}`);
}
