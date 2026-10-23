import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

export function deviceEventDetails(event: DeviceEvent) {
  const side = EVENT_KINDS[event.kind].counterparty;
  const counterparties = side === 'destination' ? event.destinations : event.sources;
  const items = event.lines.length
    ? event.payload.lineItems.slice(0, event.lines.length)
    : event.payload.lineItems;
  return items.map((item, index) => {
    const line = event.lines[index];
    const counterpartyId = side === 'destination' ? item.destinationId : item.sourceId;
    return {
      key: line?.key ?? String(index),
      item,
      product: line?.orderable.fullProductName || item.orderableId,
      lotCode: line?.lot?.lotCode,
      productHasLots: line?.productHasLots,
      reason: event.reasons?.find((reason) => reason.id === item.reasonId)?.name,
      counterparty:
        side === 'none'
          ? undefined
          : counterparties?.find((entry) => entry.id === counterpartyId)?.name,
    };
  });
}
