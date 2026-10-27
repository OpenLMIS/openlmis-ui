import { expect, it } from 'vitest';
import { formatCurrency } from '@/features/requisitions/lib/currency';

const settings = {
  currencyCode: 'USD',
  currencySymbol: '$',
  currencySymbolSide: 'left' as const,
  currencyDecimalPlaces: 2,
  groupingSize: 3,
  groupingSeparator: ',',
  decimalSeparator: '.',
};
it('uses deployment separators, grouping size, precision and symbol side', () => {
  expect(formatCurrency(25434.54, settings)).toBe('$25,434.54');
  expect(
    formatCurrency(12345.678, {
      ...settings,
      currencyCode: 'EUR',
      currencySymbol: '€',
      currencySymbolSide: 'right',
      currencyDecimalPlaces: 3,
      groupingSize: 2,
      groupingSeparator: ' ',
      decimalSeparator: ',',
    }),
  ).toBe('1 23 45,678\u00a0€');
  expect(formatCurrency(12345.6, { ...settings, currencyDecimalPlaces: 0 })).toBe('$12,346');
});
it('uses the currency code when no symbol is configured and keeps missing amounts empty', () => {
  expect(formatCurrency(12, { ...settings, currencySymbol: '' })).toBe('USD12.00');
  expect(formatCurrency(null, settings)).toBeNull();
});
