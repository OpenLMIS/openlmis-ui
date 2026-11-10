import { shippedQuantity } from '@/features/orders/lib/pod-lines';
import type {
  PodBody,
  PodDraft,
  PodResponse,
  PodStatus,
  PodWritableLine,
  ProofOfDelivery,
} from '@/features/orders/lib/pod-types';
import { acceptedFormatError, returnedQuantity } from '@/features/orders/lib/pod-validation';
import { toOptionalWholeNumber } from '@/lib/whole-number';
export function buildPodBody(pod: ProofOfDelivery, draft: PodDraft, status: PodStatus): PodBody {
  return {
    shipment: { id: pod.shipment.id },
    status,
    receivedBy: draft.receivedBy,
    deliveredBy: draft.deliveredBy,
    receivedDate: draft.receivedDate,
    lineItems: pod.lineItems.map((line) => {
      const saved: PodWritableLine = {
        id: line.id,
        quantityAccepted: line.quantityAccepted,
        quantityRejected: line.quantityRejected,
        vvmStatus: line.vvmStatus,
        rejectionReasonId: line.rejectionReasonId,
        notes: line.notes,
      };
      const shipped = shippedQuantity(line, pod.shipment.lineItems);
      const values = draft.lines[line.id];
      if (shipped === null || !values) return saved;
      const error = acceptedFormatError(values.accepted);
      if (error) throw new Error(error);
      return {
        id: line.id,
        quantityAccepted: toOptionalWholeNumber(values.accepted),
        quantityRejected: returnedQuantity(shipped, values.accepted),
        vvmStatus: values.vvm || null,
        rejectionReasonId: values.reason || null,
        notes: values.notes,
      };
    }),
  };
}
export function mergeSavedPod(cached: ProofOfDelivery, response: PodResponse): ProofOfDelivery {
  return {
    ...cached,
    status: response.status,
    receivedBy: response.receivedBy,
    deliveredBy: response.deliveredBy,
    receivedDate: response.receivedDate,
    lineItems: cached.lineItems.map((line) => ({
      ...line,
      ...response.lineItems.find((saved) => saved.id === line.id),
    })),
  };
}
