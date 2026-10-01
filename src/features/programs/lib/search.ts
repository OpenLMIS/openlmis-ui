import { z } from 'zod';
import { type DefaultSort, tableSearchSchema } from '@/lib/table-search';

export const PROGRAM_HIDEABLE_COLUMNS = [
  { id: 'code', labelKey: 'programs.code', hideBelow: 'md' },
  { id: 'active', labelKey: 'programs.status', hideBelow: 'sm' },
] as const;

const PROGRAM_SORT_FIELDS = ['name', 'code', 'active'] as const;

export type ProgramSortField = (typeof PROGRAM_SORT_FIELDS)[number];

export const DEFAULT_PROGRAMS_SORT: DefaultSort = { id: 'name', desc: false };

export const programsSearchSchema = tableSearchSchema(PROGRAM_SORT_FIELDS).extend({
  program: z
    .union([z.literal('new'), z.guid()])
    .optional()
    .catch(undefined),
});

export type ProgramsSearch = z.infer<typeof programsSearchSchema>;
