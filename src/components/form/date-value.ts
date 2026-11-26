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
const DATE_SEPARATORS = /[/ .-]/g;
const INVALID_DATE_PREFIX = '\u0000';
const ARABIC_DATE_DIGITS = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';

export function supportedDateFormat(format: unknown): format is string {
  return (
    typeof format === 'string' &&
    DATE_FORMAT.test(format) &&
    new Set(format.match(DATE_PARTS)?.map((token) => token[0])).size === 3
  );
}

function civilDateParts(value: string) {
  const match = DATE_VALUE.exec(value);
  if (!match) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? { y: year, M: month, d: day }
    : undefined;
}

export function isEditableDateValue(value: string) {
  const date = civilDateParts(value);
  return Boolean(date && date.y >= FIRST_DATE_YEAR && date.y <= lastDateYear());
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

const partWidth = (token: string) => (token === 'yyyy' ? 4 : 2);

export function advanceDateText(
  previous: string,
  next: string,
  format: string,
  afterAddedSeparator = false,
): string {
  if (next.length !== previous.length + 1 || !next.startsWith(previous)) return next;
  const inserted = next.slice(-1);
  if (afterAddedSeparator && /[/ .-]/.test(inserted)) return previous;
  const insertedDigit = normalizeDateDigits(inserted);
  if (!/^\d$/.test(insertedDigit)) return next;

  const pattern = supportedDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  const tokens = pattern.match(DATE_PARTS) ?? [];
  const separators = pattern.match(DATE_SEPARATORS) ?? [];
  const usedSeparators = previous.match(DATE_SEPARATORS) ?? [];
  if (usedSeparators.some((separator, index) => separator !== separators[index])) return next;

  const parts = previous.split(DATE_SEPARATORS);
  const index = parts.length - 1;
  const token = tokens[index];
  const completed = parts.slice(0, index).map(normalizeDateDigits);
  const partDigits = (part: number) => (tokens[part] === 'yyyy' ? /^\d{4}$/ : /^\d{1,2}$/);
  if (!token || completed.some((digits, part) => !partDigits(part).test(digits))) return next;

  const digits = normalizeDateDigits(parts[index]) + insertedDigit;
  if (!/^\d+$/.test(digits)) return next;
  const separator = separators[index] ?? '';
  if (digits.length === partWidth(token)) return next + separator;
  const maxLead = token[0] === 'd' ? 3 : 1;
  if (token === 'yyyy' || digits.length !== 1 || Number(digits) <= maxLead) return next;
  const zero = String.fromCharCode(inserted.charCodeAt(0) - Number(insertedDigit));
  return previous + zero + inserted + separator;
}

export function parseDateText(text: string, format = DEFAULT_DATE_FORMAT): string | undefined {
  const digits = normalizeDateDigits(text);
  const pattern = supportedDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  const tokens = pattern.match(DATE_PARTS) ?? [];
  const expression = pattern
    .replaceAll('.', '\\.')
    .replace(DATE_PARTS, (token) => (token === 'yyyy' ? '(\\d{4})' : '(\\d{1,2})'));
  const match = new RegExp(`^${expression}$`).exec(digits);
  if (!match) return isEditableDateValue(digits) ? digits : undefined;
  const parts = Object.fromEntries(tokens.map((token, index) => [token[0], match[index + 1]]));
  const value = `${parts.y}-${parts.M.padStart(2, '0')}-${parts.d.padStart(2, '0')}`;
  return isEditableDateValue(value) ? value : undefined;
}

export function unparsedDateValue(text: string): string {
  return text.startsWith(INVALID_DATE_PREFIX) || civilDateParts(text)
    ? INVALID_DATE_PREFIX + text
    : text;
}

export function formatDateText(value: string, format = DEFAULT_DATE_FORMAT): string {
  if (value.startsWith(INVALID_DATE_PREFIX)) return value.slice(INVALID_DATE_PREFIX.length);
  const parts = civilDateParts(value);
  if (!parts) return value;
  const pattern = supportedDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  return pattern.replace(DATE_PARTS, (token) =>
    String(parts[token[0] as keyof typeof parts]).padStart(token.length, '0'),
  );
}
