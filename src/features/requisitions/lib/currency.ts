import type { CurrencySettings } from '@/features/reference-data/lib/types';

export function formatCurrency(
  value: number | null | undefined,
  settings: CurrencySettings,
): string | null {
  if (value == null) return null;
  const [integer = '', fraction] = value.toFixed(settings.currencyDecimalPlaces).split('.');
  const size = settings.groupingSize;
  const grouped =
    size > 0
      ? integer.replace(
          new RegExp(`\\d(?=(\\d{${size}})+$)`, 'g'),
          `$&${settings.groupingSeparator}`,
        )
      : integer;
  const amount = fraction == null ? grouped : `${grouped}${settings.decimalSeparator}${fraction}`;
  const symbol = settings.currencySymbol;
  return settings.currencySymbolSide === 'right'
    ? `${amount}\u00a0${symbol}`
    : `${symbol}${amount}`;
}
