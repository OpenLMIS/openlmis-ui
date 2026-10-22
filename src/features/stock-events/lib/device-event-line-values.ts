import type { ParseKeys, TFunction } from 'i18next';
import { formatDateValue } from '@/components/form/date-value';
import {
  COUNTERPARTY,
  EVENT_KINDS,
  type EventKindConfig,
} from '@/features/stock-events/lib/event-kinds';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { vvmItems } from '@/features/stock-events/lib/vvm-items';

export function deviceEventLineValues(event: DeviceEvent, language: string, t: TFunction) {
  const config: EventKindConfig = EVENT_KINDS[event.kind];
  const counterparty = config.counterparty === 'none' ? null : COUNTERPARTY[config.counterparty];
  return event.payload.lineItems.map((item, index) => {
    const line = event.lines[index];
    const values: Partial<Record<ParseKeys, string | null | undefined>> = {
      'offline-events.lot': line?.lot?.lotCode,
      'offline-events.quantity': new Intl.NumberFormat(language).format(item.quantity),
      'offline-events.reason': event.reasons?.find((reason) => reason.id === item.reasonId)?.name,
      'stock-events.reason-comments': item.reasonFreeText,
      'offline-events.occurred-date': item.occurredDate
        ? formatDateValue(item.occurredDate, language)
        : undefined,
      'stock-events.vvm-status': item.extraData?.vvmStatus
        ? vvmItems(t).find((entry) => entry.value === item.extraData?.vvmStatus)?.label
        : undefined,
    };
    if (counterparty) {
      const destination = config.counterparty === 'destination';
      values[counterparty.column] = (destination ? event.destinations : event.sources)?.find(
        (entry) => entry.id === (destination ? item.destinationId : item.sourceId),
      )?.name;
      values[counterparty.comments] = destination ? item.destinationFreeText : item.sourceFreeText;
    }
    return {
      key: line?.key ?? index,
      product: line?.orderable.fullProductName || item.orderableId,
      values,
    };
  });
}
