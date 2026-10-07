import { useTranslation } from 'react-i18next';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { QuantityUnit } from '@/lib/quantity';

type QuantityUnitToggleProps = {
  unit: QuantityUnit;
  onUnitChange: (unit: QuantityUnit) => void;
  disabled?: boolean;
};

const UNITS = ['PACKS', 'DOSES'] as const;

export function QuantityUnitToggle({ unit, onUnitChange, disabled }: QuantityUnitToggleProps) {
  const { t } = useTranslation();
  const labels = { PACKS: t('quantity-unit.packs'), DOSES: t('quantity-unit.doses') };

  return (
    <div>
      <RadioGroup
        aria-label={t('quantity-unit.label')}
        disabled={disabled}
        onValueChange={(value) => onUnitChange(value as QuantityUnit)}
        value={unit}
        variant="segmented"
      >
        {UNITS.map((value) => (
          <RadioGroupItem key={value} value={value} variant="segmented">
            {labels[value]}
          </RadioGroupItem>
        ))}
      </RadioGroup>
    </div>
  );
}
