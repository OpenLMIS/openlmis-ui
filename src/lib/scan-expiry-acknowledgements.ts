import { useLoginData } from '@/features/auth/store/login-data';
import type { ScanLot } from '@/lib/stock-scan';

const acknowledged = new Set<string>();
const batchKey = (lot: ScanLot) =>
  lot.id ? `id:${lot.id.toLowerCase()}` : `code:${lot.lotCode.toLowerCase()}`;

export function acknowledgeScanExpiry(lot: ScanLot) {
  acknowledged.add(batchKey(lot));
}

export function isScanExpiryAcknowledged(lot: ScanLot) {
  return acknowledged.has(batchKey(lot));
}

useLoginData.subscribe((state, previous) => {
  if (state.referenceDataUserId !== previous.referenceDataUserId) acknowledged.clear();
});
