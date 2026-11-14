import type { PodDraft, ProofOfDelivery } from '@/features/orders/lib/pod-types';

export function podDraft(pod: ProofOfDelivery): PodDraft {
  return {
    receivedBy: pod.receivedBy ?? '',
    deliveredBy: pod.deliveredBy ?? '',
    receivedDate: pod.receivedDate ?? '',
    lines: Object.fromEntries(
      pod.lineItems.map((line) => [
        line.id,
        {
          accepted: line.quantityAccepted == null ? '' : String(line.quantityAccepted),
          reason: line.rejectionReasonId ?? '',
          vvm: line.vvmStatus ?? '',
          notes: line.notes ?? '',
        },
      ]),
    ),
  };
}

export function mergePodDraft(current: PodDraft, submitted: PodDraft, saved: PodDraft): PodDraft {
  return {
    receivedBy: current.receivedBy === submitted.receivedBy ? saved.receivedBy : current.receivedBy,
    deliveredBy:
      current.deliveredBy === submitted.deliveredBy ? saved.deliveredBy : current.deliveredBy,
    receivedDate:
      current.receivedDate === submitted.receivedDate ? saved.receivedDate : current.receivedDate,
    lines: Object.fromEntries(
      Object.entries(current.lines).map(([id, values]) => {
        const merge = (key: keyof typeof values) =>
          values[key] === submitted.lines[id]?.[key]
            ? (saved.lines[id]?.[key] ?? values[key])
            : values[key];
        return [
          id,
          {
            accepted: merge('accepted'),
            reason: merge('reason'),
            vvm: merge('vvm'),
            notes: merge('notes'),
          },
        ];
      }),
    ),
  };
}
