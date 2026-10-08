import type { EventTypeFilter, StockEventType } from '@/features/stock-events/lib/types';

const TYPE_KEYS = {
  issue: 'transaction-history.type-issue',
  receive: 'transaction-history.type-receive',
  adjustment: 'transaction-history.type-adjustment',
} as const satisfies Record<EventTypeFilter, string>;

export const eventTypeKey = (type: StockEventType | EventTypeFilter | null | undefined) =>
  type ? TYPE_KEYS[type.toLowerCase() as EventTypeFilter] : undefined;

export function formatEventDay(value: string | null | undefined, locale: string) {
  const date = value ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}
