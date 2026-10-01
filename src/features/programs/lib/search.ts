import { z } from 'zod';
import type { ProgramsQuery } from '@/features/programs/lib/types';
import {
  type DefaultSort,
  tableSearchSchema,
  toPaginationState,
  toSortParam,
} from '@/lib/table-search';

export const PROGRAM_HIDEABLE_COLUMNS = [
  { id: 'code', labelKey: 'programs.code', hideBelow: 'md' },
  { id: 'active', labelKey: 'programs.status', hideBelow: 'sm' },
] as const;

const PROGRAM_SORT_FIELDS = ['name', 'code', 'active'] as const;

export const DEFAULT_PROGRAMS_SORT: DefaultSort = { id: 'name', desc: false };

export const programsSearchSchema = tableSearchSchema(PROGRAM_SORT_FIELDS).extend({
  program: z
    .union([z.literal('new'), z.guid()])
    .optional()
    .catch(undefined),
});

export type ProgramsSearch = z.infer<typeof programsSearchSchema>;

export function toProgramsQuery(search: ProgramsSearch): ProgramsQuery {
  const { pageIndex, pageSize } = toPaginationState(search);
  return { page: pageIndex, size: pageSize, sort: toSortParam(search, DEFAULT_PROGRAMS_SORT) };
}
