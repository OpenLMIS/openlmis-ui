import type { ProgramBody, ProgramsQuery } from '@/features/programs/lib/types';
import type { Program } from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchProgramsPage(query: ProgramsQuery) {
  const { data } = await client.post<Page<Program>>('/programs/search', {}, { params: query });
  return data;
}

export async function fetchProgram(id: string): Promise<Program> {
  const { data } = await client.get<Program>(`/programs/${id}`);
  return data;
}

export async function createProgram(body: ProgramBody): Promise<Program> {
  const { data } = await client.post<Program>('/programs', body);
  return data;
}

export async function updateProgram(id: string, body: ProgramBody): Promise<Program> {
  const { data } = await client.put<Program>(`/programs/${id}`, body);
  return data;
}
