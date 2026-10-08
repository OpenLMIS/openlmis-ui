import type { StockEventSummary } from '@/features/stock-events/lib/types';
import { hasProgramGrant, type Permissions } from '@/lib/permissions';

export function canReverseEvent(
  permissions: Permissions,
  event: StockEventSummary,
  cancelRight: string,
) {
  return (
    event.reversible === true &&
    hasProgramGrant(permissions, cancelRight, event.facilityId, event.programId)
  );
}
