import type { ProgramBody } from '@/features/programs/lib/types';
import type { Program } from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';

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
