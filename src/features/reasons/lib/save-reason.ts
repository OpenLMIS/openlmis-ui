import { isAxiosError } from 'axios';
import {
  createReason,
  createValidReason,
  deleteValidReason,
  updateReason,
} from '@/features/reasons/api/api';
import {
  diffPairs,
  type PairDraft,
  type PairRef,
  pairKey,
  toPairDraft,
} from '@/features/reasons/lib/reason-form';
import type { ReasonBody, ValidReason } from '@/features/reasons/lib/types';
import type { Reason } from '@/features/reference-data/lib/types';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { settleFew } from '@/lib/settle-few';

const isAlreadyGone = (error: unknown) =>
  isAxiosError<{ messageKey?: string }>(error) &&
  /\.reasonAssignment\.notFound$/.test(error.response?.data?.messageKey ?? '');

type SaveReasonInput = {
  id?: string;
  body: ReasonBody;
  savedPairs: ValidReason[];
  pairs: PairDraft[];
};

export async function saveReason({ id, body, savedPairs, pairs }: SaveReasonInput): Promise<{
  reason: Reason;
  pairs: ValidReason[];
  failed: PairRef[];
  error?: unknown;
}> {
  const scope = getSessionScope();
  const reason = id ? await updateReason(id, body) : await createReason(body);
  assertSessionScope(scope);
  const { remove, add } = diffPairs(savedPairs, pairs);

  const removed = await settleFew(remove, (valid) =>
    deleteValidReason(valid.id).then(
      () => valid,
      (error: unknown) => {
        if (!isAlreadyGone(error)) throw error;
        return valid;
      },
    ),
  );
  assertSessionScope(scope);
  const notRemoved = removed.failed.map(toPairDraft);
  const stuck = new Set(notRemoved.map(pairKey));
  const added = await settleFew(
    add.filter((pair) => !stuck.has(pairKey(pair))),
    (pair) =>
      createValidReason({
        program: { id: pair.programId },
        facilityType: { id: pair.facilityTypeId },
        hidden: !pair.show,
        reason: { id: reason.id },
      }),
  );
  assertSessionScope(scope);
  const mismatched = added.done.filter((valid) => {
    const draft = add.find((pair) => pairKey(pair) === pairKey(toPairDraft(valid)));
    return draft?.show === valid.hidden;
  });

  return {
    reason,
    pairs: [...savedPairs.filter((valid) => !removed.done.includes(valid)), ...added.done],
    failed: [...notRemoved, ...added.failed, ...mismatched.map(toPairDraft)].map(
      ({ programId, facilityTypeId }) => ({ programId, facilityTypeId }),
    ),
    error: removed.error ?? added.error,
  };
}
