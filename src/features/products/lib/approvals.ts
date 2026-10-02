import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { ResponsiveColumn } from '@/components/data-table/responsive-columns';

export const APPROVAL_HIDEABLE_COLUMNS = [
  { id: 'maxPeriodsOfStock', labelKey: 'products.approvals.max-periods', hideBelow: '2xl' },
  { id: 'minPeriodsOfStock', labelKey: 'products.approvals.min-periods', hideBelow: '5xl' },
  { id: 'emergencyOrderPoint', labelKey: 'products.approvals.emergency-point', hideBelow: '4xl' },
] as const satisfies readonly (ResponsiveColumn & { labelKey: ParseKeys })[];

export const approvalsSearchSchema = z.object({
  approval: z.string().optional().catch(undefined),
  remove: z.string().optional().catch(undefined),
});

export type ApprovalsSearch = z.infer<typeof approvalsSearchSchema>;

export const CLOSED_APPROVAL_DIALOGS = {
  approval: undefined,
  remove: undefined,
} satisfies ApprovalsSearch;
