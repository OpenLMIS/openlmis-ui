import { useTranslation } from 'react-i18next';
import {
  RecordSummary,
  RecordSummaryField,
  RecordSummaryFieldSkeleton,
  RecordSummaryFields,
  RecordSummaryHeading,
} from '@/components/display/record-summary';
import { formatDateValue } from '@/components/form/date-value';
import { Skeleton } from '@/components/ui/skeleton';
import type { StockCard } from '@/features/stock-card/lib/types';
import { orEmpty } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { stockProductName } from '@/lib/stock-labels';

export function StockCardHeader({ card, unit }: { card: StockCard; unit: QuantityUnit }) {
  const { t, i18n } = useTranslation();
  const packSize = card.orderable.netContent;
  return (
    <RecordSummary>
      <RecordSummaryHeading>
        <bdi>{stockProductName(card.orderable)}</bdi>
      </RecordSummaryHeading>
      <RecordSummaryFields>
        <RecordSummaryField label={t('stock-card.product-code')}>
          {orEmpty(card.orderable.productCode)}
        </RecordSummaryField>
        <RecordSummaryField label={t('stock-card.pack-size')}>
          {packSize == null
            ? orEmpty(packSize)
            : new Intl.NumberFormat(i18n.language).format(packSize)}
        </RecordSummaryField>
        <RecordSummaryField label={t('stock-card.facility')}>
          {orEmpty(card.facility.name)}
        </RecordSummaryField>
        <RecordSummaryField label={t('stock-card.program')}>
          {orEmpty(card.program.name)}
        </RecordSummaryField>
        <RecordSummaryField label={t('stock-card.stock-on-hand')}>
          <span className="tabular-nums" dir="ltr">
            {orEmpty(cardQuantity(card.stockOnHand, packSize, unit, i18n.language))}
          </span>
        </RecordSummaryField>
        {card.lot && (
          <>
            <RecordSummaryField label={t('stock-card.lot-number')}>
              {orEmpty(card.lot.lotCode)}
            </RecordSummaryField>
            <RecordSummaryField label={t('stock-card.expiry-date')}>
              {card.lot.expirationDate
                ? formatDateValue(card.lot.expirationDate, i18n.language)
                : orEmpty(card.lot.expirationDate)}
            </RecordSummaryField>
          </>
        )}
      </RecordSummaryFields>
    </RecordSummary>
  );
}

const SKELETON_FIELDS = ['code', 'pack', 'facility', 'program', 'balance', 'lot', 'expiry'];

export function StockCardHeaderSkeleton({ lot = true }: { lot?: boolean }) {
  return (
    <RecordSummary aria-busy>
      <RecordSummaryHeading>
        <div className="h-4 w-32">
          <Skeleton fill />
        </div>
      </RecordSummaryHeading>
      <RecordSummaryFields>
        {SKELETON_FIELDS.filter((id) => lot || (id !== 'lot' && id !== 'expiry')).map((id) => (
          <RecordSummaryFieldSkeleton key={id} />
        ))}
      </RecordSummaryFields>
    </RecordSummary>
  );
}
