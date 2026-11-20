const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify([locale, options]);
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

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

export function toDateValue(date: Date, timeZone?: string): string {
  if (timeZone)
    return dateFormatter('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: knownTimeZone(timeZone),
    }).format(date);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateValue(value: string, locale: string): string {
  const date = parseDateValue(value);
  return date ? dateFormatter(locale, { dateStyle: 'medium' }).format(date) : '';
}

const knownTimeZone = (timeZone: string | undefined) => {
  if (!timeZone) return undefined;
  try {
    dateFormatter('en', { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
};

export function formatTimestamp(
  value: string | null | undefined,
  locale: string,
  { time = false, timeZone }: { time?: boolean | 'short'; timeZone?: string | undefined } = {},
): string {
  const date = value ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) return '';
  return dateFormatter(locale, {
    dateStyle: 'medium',
    ...(time && { timeStyle: time === 'short' ? 'short' : 'medium' }),
    timeZone: knownTimeZone(timeZone),
  }).format(date);
}

export const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy';
export const FIRST_DATE_YEAR = 1900;
export const lastDateYear = () => new Date().getFullYear() + 100;

const DATE_FORMAT = /^(?:dd?|MM?|yyyy)(?:[/ .-](?:dd?|MM?|yyyy)){2}$/;
const DATE_PARTS = /dd?|MM?|yyyy/g;
const INVALID_DATE_PREFIX = '\u0000';
const ARABIC_DATE_DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';

export function supportedDateFormat(format: unknown): format is string {
  return (
    typeof format === 'string' &&
    DATE_FORMAT.test(format) &&
    new Set(format.match(DATE_PARTS)?.map((token) => token[0])).size === 3
  );
}

export function parseEditableDate(value: string): Date | undefined {
  const date = parseDateValue(value);
  if (!date) return undefined;
  const year = date.getFullYear();
  return year >= FIRST_DATE_YEAR && year <= lastDateYear() ? date : undefined;
}

function normalizeDateDigits(text: string) {
  return text
    .trim()
    .replace(/[٠-٩۰-۹]/g, (digit) => String(ARABIC_DATE_DIGITS.indexOf(digit) % 10));
}

export function parseDateText(text: string, format = DEFAULT_DATE_FORMAT): string | undefined {
  const digits = normalizeDateDigits(text);
  const pattern = supportedDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  const tokens = pattern.match(DATE_PARTS) ?? [];
  const expression = pattern
    .replaceAll('.', '\\.')
    .replace(DATE_PARTS, (token) => (token === 'yyyy' ? '(\\d{4})' : '(\\d{1,2})'));
  const match = new RegExp(`^${expression}$`).exec(digits);
  if (!match) return parseEditableDate(digits) ? digits : undefined;
  const parts = Object.fromEntries(tokens.map((token, index) => [token[0], match[index + 1]]));
  const value = `${parts.y}-${parts.M.padStart(2, '0')}-${parts.d.padStart(2, '0')}`;
  return parseEditableDate(value) ? value : undefined;
}

export function unparsedDateValue(text: string): string {
  return text.startsWith(INVALID_DATE_PREFIX) || parseDateValue(text)
    ? INVALID_DATE_PREFIX + text
    : text;
}

export function formatDateText(value: string, format = DEFAULT_DATE_FORMAT): string {
  if (value.startsWith(INVALID_DATE_PREFIX)) return value.slice(INVALID_DATE_PREFIX.length);
  const date = parseDateValue(value);
  if (!date) return value;
  const pattern = supportedDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  const parts = { d: date.getDate(), M: date.getMonth() + 1, y: date.getFullYear() };
  return pattern.replace(DATE_PARTS, (token) =>
    String(parts[token[0] as keyof typeof parts]).padStart(token.length, '0'),
  );
}
