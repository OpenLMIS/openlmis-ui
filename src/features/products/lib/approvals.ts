import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { ResponsiveColumn } from '@/components/data-table/responsive-columns';
import type { Approval } from '@/features/products/lib/types';

export const APPROVAL_HIDEABLE_COLUMNS = [
  { id: 'maxPeriodsOfStock', labelKey: 'products.approvals.max-periods', hideBelow: '2xl' },
  { id: 'emergencyOrderPoint', labelKey: 'products.approvals.emergency-point', hideBelow: '4xl' },
  { id: 'minPeriodsOfStock', labelKey: 'products.approvals.min-periods', hideBelow: '5xl' },
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

const byName = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '');

export function groupApprovals(approvals: readonly Approval[]) {
  const groups = new Map<
    string,
    { facilityType: Approval['facilityType']; approvals: Approval[] }
  >();
  for (const approval of approvals) {
    const group = groups.get(approval.facilityType.id);
    if (group) group.approvals.push(approval);
    else
      groups.set(approval.facilityType.id, {
        facilityType: approval.facilityType,
        approvals: [approval],
      });
  }
  return [...groups.values()]
    .sort((a, b) => byName(a.facilityType.name, b.facilityType.name))
    .map((group) => ({
      ...group,
      approvals: group.approvals.toSorted((a, b) => byName(a.program.name, b.program.name)),
    }));
}
