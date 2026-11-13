import { expect, it } from 'vitest';
import { formatMoney } from '@/features/buq/lib/money';

const SETTINGS = {
  currencyCode: 'USD',
  currencySymbol: '$',
  currencySymbolSide: 'right',
  currencyDecimalPlaces: 2,
  groupingSize: 3,
  groupingSeparator: ' ',
  decimalSeparator: ',',
} satisfies Parameters<typeof formatMoney>[1];

it('formats money with the deployment grouping, decimal mark and symbol side', () => {
  expect(formatMoney(7388.46, SETTINGS)).toBe('7 388,46 $');
  expect(formatMoney(-1767.5, { ...SETTINGS, currencySymbolSide: 'left' })).toBe('-$1 767,50');
});
