import type { ProgramsSearch } from '@/features/programs/lib/search';
import { DEFAULT_PROGRAMS_SORT } from '@/features/programs/lib/search';
import { programName } from '@/features/reference-data/lib/programs';
import type { Program } from '@/features/reference-data/lib/types';
import { toPaginationState, toSortingState } from '@/lib/table-search';

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

const COMPARE: Record<string, (a: Program, b: Program) => number> = {
  name: (a, b) => byText(programName(a), programName(b)),
  code: (a, b) => byText(a.code, b.code),
  active: (a, b) => Number(Boolean(a.active)) - Number(Boolean(b.active)),
};

/** The page of programs the URL asks for; `GET /programs` cannot page or sort, so the browser does. */
export function pageOfPrograms(programs: readonly Program[], search: ProgramsSearch) {
  const [{ id, desc }] = toSortingState(search, DEFAULT_PROGRAMS_SORT) as [
    { id: string; desc: boolean },
  ];
  const compare = COMPARE[id] ?? COMPARE.name;
  const sorted = [...programs].sort(
    (a, b) => (desc ? -compare(a, b) : compare(a, b)) || byText(a.code, b.code),
  );
  const { pageIndex, pageSize } = toPaginationState(search);
  return {
    content: sorted.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    totalElements: sorted.length,
    totalPages: Math.ceil(sorted.length / pageSize),
  };
}
