import i18n from '@/integrations/i18n';

export type BatchSessionMarker = {
  userId: string;
  requisitionId: string;
  attemptedAt: string;
  baselineModifiedDate: string;
  baselineStatus: string;
};
const markerKey = (userId: string, id: string) => `requisition-batch-approval:${userId}:${id}`;
export function readBatchSessionMarker(userId: string, id: string): BatchSessionMarker | undefined {
  const value = sessionStorage.getItem(markerKey(userId, id));
  if (!value) return;
  const marker = JSON.parse(value) as BatchSessionMarker;
  if (
    marker.userId !== userId ||
    marker.requisitionId !== id ||
    typeof marker.attemptedAt !== 'string' ||
    typeof marker.baselineModifiedDate !== 'string' ||
    typeof marker.baselineStatus !== 'string'
  )
    throw new Error(i18n.t('requisitions.batch.uncertain'));
  return marker;
}
export function writeBatchSessionMarker(userId: string, id: string, marker?: BatchSessionMarker) {
  const key = markerKey(userId, id);
  if (marker) sessionStorage.setItem(key, JSON.stringify(marker));
  else sessionStorage.removeItem(key);
}
