import { z } from 'zod';
import type { GeographicLevel, GeographicZone } from '@/features/reference-data/lib/types';
import { MAX_WHOLE_NUMBER, toOptionalWholeNumber, wholeNumberText } from '@/lib/whole-number';

export function geographicZonePolicy(
  zone: { level: { levelNumber?: number | null } },
  levels: readonly GeographicLevel[] | undefined,
  automatic: boolean,
) {
  const numbers = levels?.map((level) => level.levelNumber).filter(isLevelNumber) ?? [];
  if (!numbers.length || !isLevelNumber(zone.level.levelNumber)) return null;
  const lowest = zone.level.levelNumber === Math.max(...numbers);
  return { editable: !automatic || lowest, visualizable: !lowest };
}

function isLevelNumber(value: number | null | undefined): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= -2_147_483_648 &&
    value <= MAX_WHOLE_NUMBER
  );
}

export const zoneFormSchema = z.object({
  catchmentPopulation: wholeNumberText(
    {
      invalid: 'geographic-zones.form.population-whole',
      tooLarge: 'geographic-zones.form.population-too-large',
    },
    { optional: true },
  ),
});

export type ZoneFormValues = z.infer<typeof zoneFormSchema>;

export function toZoneFormValues(saved: GeographicZone): ZoneFormValues {
  return {
    catchmentPopulation: saved.catchmentPopulation == null ? '' : String(saved.catchmentPopulation),
  };
}

export function toZoneBody(values: ZoneFormValues, saved: GeographicZone): GeographicZone {
  return { ...saved, catchmentPopulation: toOptionalWholeNumber(values.catchmentPopulation) };
}
