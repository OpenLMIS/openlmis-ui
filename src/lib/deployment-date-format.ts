import { DEFAULT_DATE_FORMAT, supportedDateFormat } from '@/components/form/date-value';

const DATE_FORMAT_KEY = 'openlmis-ui.date-format';

export function storedDateFormat() {
  try {
    const format = localStorage.getItem(DATE_FORMAT_KEY);
    return supportedDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  } catch {
    return DEFAULT_DATE_FORMAT;
  }
}

export function rememberDateFormat(format: unknown) {
  const supported = supportedDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  try {
    localStorage.setItem(DATE_FORMAT_KEY, supported);
  } catch {
    // The settings response remains usable if the browser cannot persist it.
  }
}
