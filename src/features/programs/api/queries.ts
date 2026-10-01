import { queryOptions } from '@tanstack/react-query';
import { fetchProgram } from '@/features/programs/api/api';
import { queryKeys } from '@/lib/key-factory';

export const programDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.programs.detail(id),
    queryFn: () => fetchProgram(id),
  });
