export type StockReason = {
  name: string;
  reasonType: string;
  reasonCategory: string;
};

export function namedWithFreeText(
  record: { name: string } | null | undefined,
  freeText?: string | null,
) {
  if (!record) return '';
  return freeText ? `${record.name}: ${freeText}` : record.name;
}

export function reasonLabel(
  line: { reason?: StockReason | null; reasonFreeText?: string | null },
  physicalInventory: string,
) {
  if (!line.reason) return '';
  if (line.reasonFreeText) return namedWithFreeText(line.reason, line.reasonFreeText);
  return line.reason.reasonCategory === 'PHYSICAL_INVENTORY' ? physicalInventory : line.reason.name;
}

export function stockProductName(product: {
  fullProductName: string;
  dispensable?: { displayUnit?: string | null } | null;
}) {
  const unit = product.dispensable?.displayUnit;
  return unit ? `${product.fullProductName} - ${unit}` : product.fullProductName;
}

export type EventLink = { label: string; eventId?: string };

type EventReferences = {
  eventOrigin?: string | null;
  originEventId?: string | null;
  documentNumber?: string | null;
  reversedEventId?: string | null;
  reversedEventDocumentNumber?: string | null;
  cancellationEventId?: string | null;
  cancellationEventDocumentNumber?: string | null;
};

const link = (label: string, eventId: string | null | undefined): EventLink =>
  eventId ? { label, eventId } : { label };

export function eventLinks(line: EventReferences, noNumber: string) {
  return {
    document: line.eventOrigin ? link(line.documentNumber || noNumber, line.originEventId) : null,
    reversing: line.reversedEventId
      ? link(line.reversedEventDocumentNumber || noNumber, line.reversedEventId)
      : null,
    reversedBy: line.cancellationEventId
      ? link(line.cancellationEventDocumentNumber || noNumber, line.cancellationEventId)
      : null,
  };
}
