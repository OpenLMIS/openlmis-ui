export type QuantityUnit = 'PACKS' | 'DOSES';

const hasPackSize = (netContent: number | null | undefined): netContent is number =>
  typeof netContent === 'number' && netContent !== 0;

/** One stock card's balance in the unit, with legacy's rounding: packs toward zero and the signed doses left over. */
export function cardQuantity(
  stockOnHand: number | null | undefined,
  netContent: number | null | undefined,
  unit: QuantityUnit,
): string | null {
  if (stockOnHand == null) return null;
  if (unit === 'DOSES') return String(stockOnHand);
  if (!hasPackSize(netContent)) return '0';
  const packs = Math.trunc(stockOnHand / netContent);
  const remainder = stockOnHand % netContent;
  return `${packs} ( ${remainder < 0 ? '' : '+'}${remainder} )`;
}

/** A product's balance: its own total in doses, or the cards shown summed into packs, floored as legacy does. */
export function productQuantity(
  stockOnHand: number | null | undefined,
  cardBalances: readonly (number | null | undefined)[],
  netContent: number | null | undefined,
  unit: QuantityUnit,
): string | null {
  if (unit === 'DOSES') return stockOnHand == null ? null : String(stockOnHand);
  if (cardBalances.some((balance) => balance == null)) return null;
  if (!hasPackSize(netContent)) return '0';
  const doses = cardBalances.reduce<number>((sum, balance) => sum + (balance ?? 0), 0);
  const packs = Math.floor(doses / netContent);
  const remainder = doses % netContent;
  return remainder === 0 ? String(packs) : `${packs} ( +${remainder} )`;
}
