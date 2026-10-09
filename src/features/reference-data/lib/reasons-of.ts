import type { Reason, ValidReasonAssignment } from '@/features/reference-data/lib/types';

export function reasonsOf(
  assignments: readonly ValidReasonAssignment[],
  category: string,
  reasonType?: 'DEBIT' | 'CREDIT',
): Reason[] {
  const seen = new Set<string>();
  const reasons: Reason[] = [];
  for (const { hidden, reason } of assignments) {
    if (
      hidden ||
      reason.reasonCategory !== category ||
      (reasonType !== undefined && reason.reasonType !== reasonType) ||
      seen.has(reason.id)
    )
      continue;
    seen.add(reason.id);
    reasons.push(reason);
  }
  return reasons;
}
