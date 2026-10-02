import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { ResponsiveColumn } from '@/components/data-table/responsive-columns';

export const PROGRAM_LINK_HIDEABLE_COLUMNS = [
  { id: 'category', labelKey: 'products.programs.category', hideBelow: 'xl' },
  { id: 'fullSupply', labelKey: 'products.programs.full-supply', hideBelow: '2xl' },
  { id: 'pricePerPack', labelKey: 'products.programs.price', hideBelow: 'lg' },
] as const satisfies readonly (ResponsiveColumn & { labelKey: ParseKeys })[];

export const programLinksSearchSchema = z.object({
  program: z.string().optional().catch(undefined),
  remove: z.string().optional().catch(undefined),
});

export type ProgramLinksSearch = z.infer<typeof programLinksSearchSchema>;

export const CLOSED_PROGRAM_DIALOGS = {
  program: undefined,
  remove: undefined,
} satisfies ProgramLinksSearch;
