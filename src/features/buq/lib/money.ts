import type { CurrencySettings } from '@/features/reference-data/lib/types';

export function formatMoney(value: number, settings: CurrencySettings) {
  const sign = value < 0 ? '-' : '';
  const [integer = '', fraction] = Math.abs(value)
    .toFixed(settings.currencyDecimalPlaces)
    .split('.');
  const grouped =
    settings.groupingSize > 0
      ? integer.replace(
          new RegExp(`\\d(?=(\\d{${settings.groupingSize}})+$)`, 'g'),
          `$&${settings.groupingSeparator}`,
        )
      : integer;
  const amount = fraction == null ? grouped : `${grouped}${settings.decimalSeparator}${fraction}`;
  return settings.currencySymbolSide === 'right'
    ? `${sign}${amount} ${settings.currencySymbol}`
    : `${sign}${settings.currencySymbol}${amount}`;
}
