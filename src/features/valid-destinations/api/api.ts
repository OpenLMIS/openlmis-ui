import type {
  AssignmentBody,
  AssignmentsQuery,
  SavedAssignment,
} from '@/components/valid-assignments/types';
import type { ValidDestination } from '@/features/valid-destinations/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchValidDestinations(query: AssignmentsQuery) {
  const { data } = await client.get<Page<ValidDestination>>('/validDestinations', {
    params: query,
    paramsSerializer: { indexes: null },
  });
  return data;
}

/** The server answers 200 with the one it already had for the same program, type and node. */
export async function createValidDestination(body: AssignmentBody): Promise<SavedAssignment> {
  const { data, status } = await client.post<ValidDestination>('/validDestinations', body);
  return { assignment: data, created: status === 201 };
}

export async function deleteValidDestination(id: string) {
  await client.delete(`/validDestinations/${id}`);
}
