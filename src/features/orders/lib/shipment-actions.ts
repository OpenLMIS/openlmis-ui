import { findShipmentDraft, saveShipmentDraft } from '@/features/orders/api/api';
import { shipmentSaveBody } from '@/features/orders/lib/shipment-body';
import { type ShipmentLine, shipmentLineKey } from '@/features/orders/lib/shipment-lines';
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

export function mergeShipmentFills(
  current: readonly ShipmentLine[],
  submitted: readonly ShipmentLine[],
  saved: ShipmentRecord,
): ShipmentLine[] {
  const snapshots = new Map(submitted.map((line) => [line.key, line]));
  const persisted = new Map(
    saved.lineItems.map((line) => [shipmentLineKey(line.orderable.id, line.lot?.id), line]),
  );
  return current.map((line) => {
    const response = persisted.get(shipmentLineKey(line.product.id, line.lot?.id));
    if (!response) return line;
    return {
      ...line,
      id: response.id,
      fill: line.fill === snapshots.get(line.key)?.fill ? response.quantityShipped : line.fill,
    };
  });
}
