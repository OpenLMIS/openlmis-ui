import type { Reason, ValidReasonAssignment } from '@/features/reference-data/lib/types';

export function adjustmentReasons(assignments: readonly ValidReasonAssignment[]): Reason[] {
  const seen = new Set<string>();
  const reasons: Reason[] = [];
  for (const { hidden, reason } of assignments) {
    if (hidden || reason.reasonCategory !== 'ADJUSTMENT' || seen.has(reason.id)) continue;
    seen.add(reason.id);
    reasons.push(reason);
  }
  return reasons;
}
