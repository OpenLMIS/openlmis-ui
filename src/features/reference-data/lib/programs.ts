import type { Program } from '@/features/reference-data/lib/types';

export const programName = (program: Pick<Program, 'code' | 'name'>) =>
  program.name || program.code;
