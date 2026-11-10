import type { QuantityUnit } from '@/lib/quantity';

export type ShipmentUnit = QuantityUnit;
export const shipmentPackSize = (netContent?: number | null) => netContent || 1;
export const invalidShipmentPackSize = (netContent: number | null | undefined, fill: number) =>
  fill > 0 && !netContent;
export const availableShipmentPacks = (stockOnHand: number, netContent?: number | null) =>
  Math.floor(stockOnHand / shipmentPackSize(netContent));

export function lineQuantities(
  ordered: number,
  stockOnHand: number,
  fill: number,
  netContent: number | null | undefined,
  unit: ShipmentUnit,
) {
  const multiplier = unit === 'PACKS' ? 1 : shipmentPackSize(netContent);
  const available = availableShipmentPacks(stockOnHand, netContent);
  return {
    ordered: ordered * multiplier,
    fill,
    available: available * multiplier,
    remaining: (available - fill) * multiplier,
  };
}

export function groupQuantities(
  ordered: number,
  lines: readonly { stockOnHand: number; fill: number; netContent?: number | null }[],
  netContent: number | null | undefined,
  unit: ShipmentUnit,
) {
  const multiplier = unit === 'PACKS' ? 1 : shipmentPackSize(netContent);
  const fill = lines.reduce((sum, line) => sum + line.fill, 0);
  const packs = lines.reduce(
    (sum, line) => sum + availableShipmentPacks(line.stockOnHand, line.netContent),
    0,
  );
  const available = lines.reduce(
    (sum, line) =>
      sum + lineQuantities(0, line.stockOnHand, line.fill, line.netContent, unit).available,
    0,
  );
  return { ordered: ordered * multiplier, fill, available, remaining: (packs - fill) * multiplier };
}
