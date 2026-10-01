import type { Program } from '@/features/reference-data/lib/types';

export type ProgramBody = Omit<Program, 'id'>;

export type ProgramsQuery = {
  page: number;
  size: number;
  sort: string;
};
