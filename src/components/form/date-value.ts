const DATE_VALUE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A `yyyy-MM-dd` value as that day at local midnight, or undefined when it is not a real day. */
export function parseDateValue(value: string): Date | undefined {
  const match = DATE_VALUE.exec(value);
  if (!match) return undefined;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(year, month - 1, day);
  const isSameDay =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isSameDay ? date : undefined;
}

export function toDateValue(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateValue(value: string, locale: string): string {
  const date = parseDateValue(value);
  return date ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date) : '';
}
