import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardBand, CardRows } from '@/components/card-list';
import { DataTableCard } from '@/components/data-table/data-table';
import { SettingsItem } from '@/components/form/settings-list';
import { Button } from '@/components/ui/button';
import { type CurrencySettings, formatCurrency } from '@/features/requisitions/lib/currency';

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
  const [details, setDetails] = useState(false);
  return (
    <DataTableCard>
      <CardBand>
        <span>{t('requisitions.requisition.total')}</span>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={details}
          onClick={() => setDetails(!details)}
        >
          {t('requisitions.requisition.show-details')}
        </Button>
      </CardBand>
      <div className="bg-muted/50">
        <CardRows>
          {details && (
            <SettingsItem label={t('requisitions.requisition.full-supply-subtotal')}>
              <bdi>{formatCurrency(totals.fullSupply, currency)}</bdi>
            </SettingsItem>
          )}
          {details && showNonFullSupply && (
            <SettingsItem label={t('requisitions.requisition.non-full-supply-subtotal')}>
              <bdi>{formatCurrency(totals.nonFullSupply, currency)}</bdi>
            </SettingsItem>
          )}
          <SettingsItem label={<strong>{t('requisitions.requisition.total-cost')}</strong>}>
            <strong>
              <bdi>{formatCurrency(totals.total, currency)}</bdi>
            </strong>
          </SettingsItem>
        </CardRows>
      </div>
    </DataTableCard>
  );
}
