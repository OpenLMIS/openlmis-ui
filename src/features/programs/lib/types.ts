import type { Program } from '@/features/reference-data/lib/types';

export type ProgramBody = Omit<Program, 'id'>;
