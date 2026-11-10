import { findShipmentDraft, saveShipmentDraft } from '@/features/orders/api/api';
import { shipmentSaveBody } from '@/features/orders/lib/shipment-body';
import type { ShipmentLine } from '@/features/orders/lib/shipment-lines';
import type { ShipmentRecord } from '@/features/orders/lib/shipment-types';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export class ShipmentDraftExpiredError extends Error {
  constructor() {
    super('The shipment draft no longer exists');
    this.name = 'ShipmentDraftExpiredError';
  }
}

export async function saveExistingShipmentDraft(
  draft: ShipmentRecord,
  lines: readonly ShipmentLine[],
) {
  const scope = getSessionScope();
  const existing = await findShipmentDraft(draft.order.id);
  assertSessionScope(scope);
  if (existing?.id !== draft.id) throw new ShipmentDraftExpiredError();
  const saved = await saveShipmentDraft(shipmentSaveBody(draft, lines));
  assertSessionScope(scope);
  if (saved.id !== draft.id) throw new ShipmentDraftExpiredError();
  return saved;
}
