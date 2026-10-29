import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { InputSizer } from '@/components/ui/input';
import type { QuantityUnit } from '@/lib/quantity';

export function QuantityHeaderSizer({
  unit,
  sizing,
}: {
  unit: QuantityUnit;
  sizing?: ComponentProps<typeof InputSizer>['sizing'];
}) {
  const { t } = useTranslation();
  return (
    <div
      aria-hidden
      className="invisible flex h-0 w-max items-center gap-1 overflow-hidden font-normal"
      dir="ltr"
    >
      <InputSizer
        sizing={sizing}
        placeholder={t(unit === 'PACKS' ? 'quantity-unit.packs' : 'quantity-unit.doses')}
      />
      {unit === 'PACKS' && (
        <>
          <span className="shrink-0 whitespace-nowrap">( +</span>
          <InputSizer sizing={sizing} placeholder={t('quantity-unit.doses')} />
          <span>)</span>
        </>
      )}
    </div>
  );
}
