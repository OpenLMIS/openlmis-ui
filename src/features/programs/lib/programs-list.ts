import type { ProgramSortField } from '@/features/programs/lib/search';
import type { Program } from '@/features/reference-data/lib/types';

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

const byName = (a: Program, b: Program) => byText(a.name ?? '', b.name ?? '');

const COMPARE: Record<ProgramSortField, (a: Program, b: Program) => number> = {
  name: byName,
  code: (a, b) => byText(a.code, b.code),
  active: (a, b) => Number(b.active === true) - Number(a.active === true),
};

export function sortPrograms(programs: Program[], field: ProgramSortField, desc: boolean) {
  const compare = COMPARE[field];
  return [...programs].sort((a, b) => (desc ? -compare(a, b) : compare(a, b)) || byName(a, b));
}

export function withSavedProgram(programs: Program[], saved: Program): Program[] {
  if (!programs.some((program) => program.id === saved.id)) return [...programs, saved];
  return programs.map((program) => (program.id === saved.id ? saved : program));
}
