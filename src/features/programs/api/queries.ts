import { queryOptions } from '@tanstack/react-query';
import { fetchProgram, fetchProgramsPage } from '@/features/programs/api/api';
import type { ProgramsQuery } from '@/features/programs/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const programsListOptions = (query: ProgramsQuery) =>
  queryOptions({
    queryKey: queryKeys.programs.list(query),
    queryFn: () => fetchProgramsPage(query),
  });

export const programDetailOptions = (id: string, opening: number) =>
  queryOptions({
    queryKey: [...queryKeys.programs.detail(id), opening] as const,
    queryFn: () => fetchProgram(id),
  });
