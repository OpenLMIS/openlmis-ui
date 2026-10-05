import type { ReasonSortField } from '@/features/reasons/lib/search';
import type { Reason } from '@/features/reference-data/lib/types';
import { fold } from '@/lib/text';

/** A category or type code in words, in the page's language. */
export type ReasonLabels = {
  category: (code: string) => string;
  type: (code: string) => string;
};

export function filterReasons(reasons: Reason[], q: string | undefined) {
  const term = q && fold(q.trim());
  return term ? reasons.filter((reason) => fold(reason.name).includes(term)) : reasons;
}

const compareText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

const byName = (a: Reason, b: Reason) => compareText(a.name, b.name);

export function sortReasons(
  reasons: Reason[],
  field: ReasonSortField,
  desc: boolean,
  labels: ReasonLabels,
) {
  const compare: Record<ReasonSortField, (a: Reason, b: Reason) => number> = {
    name: byName,
    category: (a, b) =>
      compareText(labels.category(a.reasonCategory), labels.category(b.reasonCategory)),
    type: (a, b) => compareText(labels.type(a.reasonType), labels.type(b.reasonType)),
  };
  const by = compare[field];
  return [...reasons].sort((a, b) => (desc ? -by(a, b) : by(a, b)) || byName(a, b));
}
