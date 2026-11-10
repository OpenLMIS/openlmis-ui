import { useAppForm } from '@/components/form/form';
import type { ShipmentLine } from '@/features/orders/lib/shipment-lines';

export const shipmentFieldKey = (key: string) => encodeURIComponent(key).replaceAll('.', '%2E');
export function shipmentValues(lines: readonly ShipmentLine[], notes?: string | null) {
  return {
    lines: Object.fromEntries(
      lines.map((line) => [shipmentFieldKey(line.key), { fill: String(line.fill ?? '') }]),
    ),
    notes: notes ?? '',
  };
}
export function useShipmentForm(initial: ReturnType<typeof shipmentValues>) {
  return useAppForm({ defaultValues: initial });
}
export type ShipmentForm = ReturnType<typeof useShipmentForm>;
