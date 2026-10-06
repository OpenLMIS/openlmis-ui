import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { QuantityUnit } from '@/lib/quantity';

type QuantityUnitToggleProps = {
  unit: QuantityUnit;
  onUnitChange: (unit: QuantityUnit) => void;
};

/** Packs or doses, as two pressed-or-not buttons, as legacy's toggle. */
export function QuantityUnitToggle({ unit, onUnitChange }: QuantityUnitToggleProps) {
  const { t } = useTranslation();
  const units = [
    { value: 'PACKS', label: t('quantity-unit.packs') },
    { value: 'DOSES', label: t('quantity-unit.doses') },
  ] as const;

  return (
    <fieldset
      aria-label={t('quantity-unit.label')}
      className="flex min-w-0 gap-0.5 rounded-lg border bg-background p-0.5"
    >
      {units.map(({ value, label }) => (
        <Button
          aria-pressed={unit === value}
          key={value}
          onClick={() => onUnitChange(value)}
          size="sm"
          type="button"
          variant={unit === value ? 'secondary' : 'ghost'}
        >
          {label}
        </Button>
      ))}
    </fieldset>
  );
}
