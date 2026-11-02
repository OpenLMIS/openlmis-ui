import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CardBand,
  CardControlRow,
  CardList,
  CardListItem,
  CardRows,
} from '@/components/display/card-list';
import { SettingsItem } from '@/components/form/settings-list';
import { useBatch, useBatchVersion } from '@/features/requisitions/components/batch-context';
import { BatchCost, BatchQuantity } from '@/features/requisitions/components/batch-quantity';
import { BatchRecordStatus } from '@/features/requisitions/components/batch-record-status';
import { batchLabel, batchRowTotals, batchTotals } from '@/features/requisitions/lib/batch';
import type { BatchRow } from '@/features/requisitions/lib/batch-types';
import { formatCurrency } from '@/features/requisitions/lib/currency';
import { EMPTY_VALUE } from '@/lib/empty-value';

function CardTotals({ row }: { row?: BatchRow }) {
  const { t } = useTranslation();
  const { drafts, records, currency } = useBatch();
  useBatchVersion(row ? `product:${row.product.id}` : 'totals');
  const totals = batchTotals(row ? [] : records, drafts.quantities());
  const product = row ? batchRowTotals(row, drafts.quantities()) : totals;
  return (
    <CardRows>
      {row && (
        <SettingsItem label={t('requisitions.batch.quantity')}>{product.quantity}</SettingsItem>
      )}
      {!row &&
        records.map((record) => (
          <SettingsItem key={record.id} label={batchLabel(record)}>
            {formatCurrency(totals.perRecord.get(record.id), currency)}
          </SettingsItem>
        ))}
      <SettingsItem label={t('requisitions.batch.total-all')}>
        {formatCurrency(product.cost, currency)}
      </SettingsItem>
    </CardRows>
  );
}
export const BatchCards = memo(function BatchCards() {
  const { t } = useTranslation();
  const { rows, records } = useBatch();
  return (
    <CardList>
      {rows.map((row) => (
        <CardListItem key={row.product.id}>
          <CardBand>
            {row.product.productCode} - {row.product.fullProductName}
          </CardBand>
          {records.map((record) => {
            const line = row.lines.get(record.id);
            return (
              <CardRows key={record.id}>
                <CardControlRow
                  label={
                    <span>
                      {batchLabel(record)}
                      <BatchRecordStatus record={record} />
                    </span>
                  }
                >
                  {line ? <BatchQuantity record={record} line={line} /> : EMPTY_VALUE}
                </CardControlRow>
                <SettingsItem label={t('requisitions.batch.cost')}>
                  {line ? <BatchCost recordId={record.id} line={line} /> : EMPTY_VALUE}
                </SettingsItem>
              </CardRows>
            );
          })}
          <CardTotals row={row} />
        </CardListItem>
      ))}
      <CardListItem>
        <CardBand>{t('requisitions.batch.total')}</CardBand>
        <CardTotals />
      </CardListItem>
    </CardList>
  );
});
