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

/** Removes pairs before adding any, as the server answers a pair it still has with the old one. */
export async function saveReason({ id, body, savedPairs, pairs }: SaveReasonInput): Promise<{
  reason: Reason;
  pairs: ValidReason[];
  failed: PairRef[];
  error?: unknown;
}> {
  const reason = id ? await updateReason(id, body) : await createReason(body);
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
  // An existing pair comes back unchanged, so a Show it kept is not saved.
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
