import { type ErrorComponentProps, Link } from '@tanstack/react-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { RecordError } from '@/components/app-shell/record-error';
import { transactionHistorySearchSchema } from '@/features/stock-events/lib/search';

export function StockEventError({
  search,
  ...props
}: ErrorComponentProps & { search: unknown; width?: ComponentProps<typeof RecordError>['width'] }) {
  const { t } = useTranslation();
  return (
    <RecordError
      {...props}
      backLink={
        <Link
          search={transactionHistorySearchSchema.parse(search)}
          to="/stock-management/transaction-history"
        />
      }
      labels={{
        back: t('stock-event.back'),
        title: t('stock-event.error-title'),
        description: t('stock-event.error-description'),
        notFoundTitle: t('stock-event.not-found-title'),
        notFoundDescription: t('stock-event.not-found-description'),
      }}
    />
  );
}
