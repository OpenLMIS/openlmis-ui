import { expect, it } from 'vitest';
import { mergePodDraft } from '@/features/orders/lib/pod-draft';
import type { PodDraft } from '@/features/orders/lib/pod-types';

it('keeps typing during save, adopting only fields unchanged since submission', () => {
  const submitted: PodDraft = {
    receivedBy: 'Receiver',
    deliveredBy: 'Driver',
    receivedDate: '',
    lines: { a: { accepted: '3', reason: 'damage', vvm: 'STAGE_1', notes: '' } },
  };
  const current = {
    ...submitted,
    receivedBy: 'New receiver',
    lines: { a: { ...submitted.lines.a, accepted: '4', notes: 'typed during save' } },
  };
  const saved = {
    ...submitted,
    receivedDate: '2026-11-10',
    lines: { a: { ...submitted.lines.a, reason: '', vvm: 'STAGE_2' } },
  };
  expect(mergePodDraft(current, submitted, saved)).toEqual({
    ...current,
    receivedDate: '2026-11-10',
    lines: { a: { accepted: '4', reason: '', vvm: 'STAGE_2', notes: 'typed during save' } },
  });
});
