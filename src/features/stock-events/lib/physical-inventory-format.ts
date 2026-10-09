import { parseDateValue } from '@/components/form/date-value';
import type { QuantityUnit } from '@/lib/quantity';

const formats = new Map<string, ReturnType<typeof createFormats>>();
function createFormats(language: string) {
  const numbers = new Intl.NumberFormat(language);
  const dates = new Intl.DateTimeFormat(language, { dateStyle: 'medium' });
  return {
    number: numbers.format,
    date: (value: string) => {
      const date = parseDateValue(value);
      return date ? dates.format(date) : '';
    },
    quantity: (
      value: number | null | undefined,
      netContent: number | null | undefined,
      unit: QuantityUnit,
    ) => {
      if (value == null) return null;
      if (unit === 'DOSES') return numbers.format(value);
      if (!netContent) return numbers.format(0);
      const remainder = value % netContent || 0;
      return `${numbers.format(Math.trunc(value / netContent) || 0)} ( ${remainder < 0 ? '' : '+'}${numbers.format(remainder)} )`;
    },
  };
}
export function inventoryFormats(language: string) {
  let format = formats.get(language);
  if (!format) {
    format = createFormats(language);
    formats.set(language, format);
  }
  return format;
}
