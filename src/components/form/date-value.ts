const DATE_VALUE = /^(\d{4})-(\d{2})-(\d{2})$/;

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

const knownTimeZone = (timeZone: string | undefined) => {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
};

export function formatTimestamp(
  value: string | null | undefined,
  locale: string,
  { time = false, timeZone }: { time?: boolean; timeZone?: string | undefined } = {},
): string {
  const date = value ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    ...(time && { timeStyle: 'medium' }),
    timeZone: knownTimeZone(timeZone),
  }).format(date);
}
