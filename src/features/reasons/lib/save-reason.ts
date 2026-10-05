import { isAxiosError } from 'axios';
import {
  createReason,
  createValidReason,
  deleteValidReason,
  updateReason,
} from '@/features/reasons/api/api';
import { diffPairs, type PairDraft, toPairDraft } from '@/features/reasons/lib/reason-form';
import type { ReasonBody, ValidReason } from '@/features/reasons/lib/types';
import type { Reason } from '@/features/reference-data/lib/types';
import { settleFew } from '@/lib/settle-few';

export type PairRef = Pick<PairDraft, 'programId' | 'facilityTypeId'>;

const isAlreadyGone = (error: unknown) =>
  isAxiosError<{ messageKey?: string }>(error) &&
  /\.reasonAssignment\.notFound$/.test(error.response?.data?.messageKey ?? '');

const toRef = ({ programId, facilityTypeId }: PairRef): PairRef => ({ programId, facilityTypeId });

const samePair = (a: PairRef, b: PairRef) =>
  a.programId === b.programId && a.facilityTypeId === b.facilityTypeId;

type SaveReasonInput = {
  /** The saved reason's id; none creates one. */
  id?: string;
  body: ReasonBody;
  savedPairs: ValidReason[];
  pairs: PairDraft[];
};

/**
 * Saves the reason, then its pairs: every removal before any addition, since the server answers
 * a re-added pair it still has with the old one. Rejects only when the reason itself is refused.
 */
export async function saveReason({ id, body, savedPairs, pairs }: SaveReasonInput): Promise<{
  reason: Reason;
  /** What the server holds now, the base for the next save. */
  pairs: ValidReason[];
  failed: PairRef[];
  error?: unknown;
}> {
  const reason = id ? await updateReason(id, body) : await createReason(body);
  const { remove, add } = diffPairs(savedPairs, pairs);

  const removed = await settleFew(remove, (valid) =>
    deleteValidReason(valid.id).catch((error: unknown) => {
      if (!isAlreadyGone(error)) throw error;
    }),
  );
  const notRemoved = removed.failed.map((valid) => toPairDraft(valid));
  const created: ValidReason[] = [];
  const added = await settleFew(
    add.filter((pair) => !notRemoved.some((stuck) => samePair(stuck, pair))),
    async (pair) => {
      const valid = await createValidReason({
        program: { id: pair.programId },
        facilityType: { id: pair.facilityTypeId },
        hidden: !pair.show,
        reason: { id: reason.id },
      });
      created.push(valid);
    },
  );
  const gone = remove.filter((valid) => !removed.failed.includes(valid));

  return {
    reason,
    pairs: [...savedPairs.filter((valid) => !gone.includes(valid)), ...created],
    failed: [...notRemoved, ...added.failed].map(toRef),
    error: removed.error ?? added.error,
  };
}
