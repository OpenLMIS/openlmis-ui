import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CardBand, CardRows } from '@/components/card-list';
import { DataTableCard } from '@/components/data-table/data-table';
import { SettingsItem } from '@/components/form/settings-list';
import type { CurrencySettings } from '@/features/reference-data/lib/types';
import { formatCurrency } from '@/features/requisitions/lib/currency';

export function RequisitionTotals({
  totals,
  currency,
  showNonFullSupply,
}: {
  totals: { fullSupply: number; nonFullSupply: number; total: number };
  currency: CurrencySettings;
  showNonFullSupply: boolean;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex justify-end">
      <div className="w-full @3xl/main:max-w-md">
        <DataTableCard>
          <CardBand>
            <h2 id={headingId}>{t('requisitions.requisition.total')}</h2>
          </CardBand>
          <div className="divide-y">
            <CardRows>
              <SettingsItem label={t('requisitions.requisition.full-supply-subtotal')}>
                <bdi>{formatCurrency(totals.fullSupply, currency)}</bdi>
              </SettingsItem>
              {showNonFullSupply && (
                <SettingsItem label={t('requisitions.requisition.non-full-supply-subtotal')}>
                  <bdi>{formatCurrency(totals.nonFullSupply, currency)}</bdi>
                </SettingsItem>
              )}
            </CardRows>
            <div className="flex items-center justify-between gap-4 bg-muted/50 px-4 py-3">
              <span className="font-semibold text-sm">
                {t('requisitions.requisition.total-cost')}
              </span>
              <span className="font-semibold text-lg tabular-nums">
                <bdi>{formatCurrency(totals.total, currency)}</bdi>
              </span>
            </div>
          </div>
        </DataTableCard>
      </div>
    </section>
  );
}
