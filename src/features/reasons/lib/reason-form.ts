import { z } from 'zod';
import type { ReasonBody, ValidReason } from '@/features/reasons/lib/types';
import type { Reason } from '@/features/reference-data/lib/types';

/** Where the reason is offered; Show is the opposite of the server's `hidden`. */
export type PairDraft = { programId: string; facilityTypeId: string; show: boolean };

export type ReasonFormValues = {
  name: string;
  category: string;
  type: string;
  isFreeTextAllowed: boolean;
  tags: string[];
  pairs: PairDraft[];
};

export const EMPTY_REASON_FORM: ReasonFormValues = {
  name: '',
  category: '',
  type: '',
  isFreeTextAllowed: false,
  tags: [],
  pairs: [],
};

const sameName = (a: string, b: string) =>
  a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'accent' }) === 0;

/** `refused` holds names the server turned down, which the loaded list may not have yet. */
export function reasonFormSchema(reasons: Reason[], ownId?: string, refused: string[] = []) {
  const taken = [
    ...reasons.filter((reason) => reason.id !== ownId).map((reason) => reason.name),
    ...refused,
  ];
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, 'reasons.form.name-required')
      .refine(
        (name) => !taken.some((other) => sameName(other, name)),
        'reasons.form.name-duplicate',
      ),
    category: z.string().min(1, 'reasons.form.category-required'),
    type: z.string().min(1, 'reasons.form.type-required'),
    isFreeTextAllowed: z.boolean(),
    tags: z.array(z.string()),
    pairs: z.array(
      z.object({ programId: z.string(), facilityTypeId: z.string(), show: z.boolean() }),
    ),
  });
}

const pairKey = (pair: Pick<PairDraft, 'programId' | 'facilityTypeId'>) =>
  `${pair.programId}|${pair.facilityTypeId}`;

/** The same program and facility type can be listed once, whatever its Show. */
export function addPairSchema(rows: PairDraft[]) {
  const listed = new Set(rows.map(pairKey));
  return z
    .object({
      programId: z.string().min(1, 'reasons.form.program-required'),
      facilityTypeId: z.string().min(1, 'reasons.form.facility-type-required'),
      show: z.boolean(),
    })
    .refine((pair) => !listed.has(pairKey(pair)), {
      message: 'reasons.form.pair-duplicate',
      path: ['facilityTypeId'],
    });
}

export const toPairDraft = (valid: ValidReason): PairDraft => ({
  programId: valid.program.id,
  facilityTypeId: valid.facilityType.id,
  show: !valid.hidden,
});

export function toReasonFormValues(reason: Reason, pairs: ValidReason[]): ReasonFormValues {
  return {
    name: reason.name,
    category: reason.reasonCategory,
    type: reason.reasonType,
    isFreeTextAllowed: reason.isFreeTextAllowed,
    tags: reason.tags,
    pairs: pairs.map(toPairDraft),
  };
}

/** On edit, the stored record with the form's changes, so a field the form doesn't show stays as it is. */
export function toReasonBody(values: ReasonFormValues, saved?: Reason): ReasonBody {
  return {
    ...saved,
    name: values.name.trim(),
    reasonCategory: saved?.reasonCategory ?? values.category,
    reasonType: saved?.reasonType ?? values.type,
    isFreeTextAllowed: values.isFreeTextAllowed,
    tags: values.tags,
  };
}

/** What to send for the draft: the server only adds and removes, so a changed Show is both. */
export function diffPairs(saved: ValidReason[], draft: PairDraft[]) {
  const drafted = new Map(draft.map((pair) => [pairKey(pair), pair]));
  const stored = new Map(saved.map((valid) => [pairKey(toPairDraft(valid)), valid]));
  const remove = saved.filter((valid) => {
    const pair = drafted.get(pairKey(toPairDraft(valid)));
    return !pair || pair.show === valid.hidden;
  });
  const add = draft.filter((pair) => {
    const valid = stored.get(pairKey(pair));
    return !valid || pair.show === valid.hidden;
  });
  return { remove, add };
}
