import type { ShipmentLine } from '@/features/orders/lib/shipment-lines';
import type { ShipmentBody, ShipmentDraftBody } from '@/features/orders/lib/shipment-types';

function bodyLines(lines: readonly ShipmentLine[], mode: 'create' | 'save' | 'confirm') {
  return lines.map((line) => {
    const versionNumber = line.product.meta?.versionNumber;
    if (versionNumber == null) throw new Error('Shipment product version is required');
    return {
      ...(mode === 'save' && line.id ? { id: line.id } : {}),
      orderable: { id: line.product.id, versionNumber },
      lot: line.lot ? { id: line.lot.id } : null,
      quantityShipped: mode === 'create' ? 0 : line.fill,
    };
  });
}
export function shipmentCreateBody(orderId: string, lines: readonly ShipmentLine[]): ShipmentBody {
  return { order: { id: orderId }, lineItems: bodyLines(lines, 'create') };
}
type DraftIdentity = { id: string; order: { id: string }; notes?: string | null };
export function shipmentSaveBody(
  draft: DraftIdentity,
  lines: readonly ShipmentLine[],
): ShipmentDraftBody {
  return {
    id: draft.id,
    order: { id: draft.order.id },
    notes: draft.notes,
    lineItems: bodyLines(lines, 'save'),
  };
}
export function shipmentConfirmBody(
  draft: DraftIdentity,
  lines: readonly ShipmentLine[],
): ShipmentBody {
  return {
    order: { id: draft.order.id },
    notes: draft.notes,
    lineItems: bodyLines(lines, 'confirm'),
  };
}
