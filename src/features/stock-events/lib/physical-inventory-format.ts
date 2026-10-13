import { formatDateValue } from '@/components/form/date-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';

const formats = new Map<string, ReturnType<typeof createFormats>>();
function createFormats(language: string) {
  const numbers = new Intl.NumberFormat(language);
  return {
    number: numbers.format,
    date: (value: string) => formatDateValue(value, language),
    quantity: (
      value: number | null | undefined,
      netContent: number | null | undefined,
      unit: QuantityUnit,
    ) => cardQuantity(value, netContent || 0, unit, language),
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
