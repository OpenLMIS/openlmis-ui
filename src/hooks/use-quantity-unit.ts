import { z } from 'zod';
import { useStoredState } from '@/hooks/use-stored-state';
import { useFlag } from '@/lib/feature-flags';
import type { QuantityUnit } from '@/lib/quantity';

const unitSchema = z.enum(['PACKS', 'DOSES']).nullable();

/** The unit quantities show in: the user's pick, else the administrator's default; the unit option only decides whether the user may switch. */
export function useQuantityUnit() {
  const defaultUnit = useFlag('DEFAULT_QUANTITY_UNIT');
  const option = useFlag('QUANTITY_UNIT_OPTION');
  const [picked, setPicked] = useStoredState<QuantityUnit | null>(
    'quantity-unit',
    unitSchema,
    null,
  );
  return {
    unit: picked ?? defaultUnit,
    setUnit: (unit: QuantityUnit) => setPicked(unit),
    canSwitch: option === 'BOTH',
  };
}
