import { DEFAULT_DATE_FORMAT, supportedDateFormat } from '@/components/form/date-value';

const DATE_FORMAT_KEY = 'openlmis-ui.date-format';

function readStoredDateFormat() {
  try {
    const format = localStorage.getItem(DATE_FORMAT_KEY);
    return supportedDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  } catch {
    return DEFAULT_DATE_FORMAT;
  }
}

let dateFormat = readStoredDateFormat();

export function storedDateFormat() {
  return dateFormat;
}

export function rememberDateFormat(format: unknown) {
  if (format === undefined) return;
  dateFormat = supportedDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  try {
    localStorage.setItem(DATE_FORMAT_KEY, dateFormat);
  } catch {
    return;
  }
}
