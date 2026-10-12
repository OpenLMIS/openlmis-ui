import { useLoginData } from '@/features/auth/store/login-data';

type AcknowledgedLot =
  | { id: string; lotCode: string }
  | { id?: undefined; lotCode: string; tradeItemId: string };

const acknowledged = new Set<string>();
const batchKey = (lot: AcknowledgedLot) =>
  lot.id !== undefined
    ? `id:${lot.id.toLowerCase()}`
    : `code:${lot.tradeItemId.toLowerCase()}:${lot.lotCode.toLowerCase()}`;

export function acknowledgeScanExpiry(lot: AcknowledgedLot) {
  acknowledged.add(batchKey(lot));
}

export function isScanExpiryAcknowledged(lot: AcknowledgedLot) {
  return acknowledged.has(batchKey(lot));
}

useLoginData.subscribe((state, previous) => {
  if (state.referenceDataUserId !== previous.referenceDataUserId) acknowledged.clear();
});
