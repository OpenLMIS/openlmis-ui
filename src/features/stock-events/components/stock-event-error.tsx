import { type ErrorComponentProps, Link } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { ChevronLeftIcon, SearchXIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/error-fallback';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Workspace, WorkspaceContent } from '@/components/workspace';
import { transactionHistorySearchSchema } from '@/features/stock-events/lib/search';
import { isNotFound } from '@/lib/http';

export function StockEventError({ search, ...props }: ErrorComponentProps & { search: unknown }) {
  const { t } = useTranslation();
  const back = (
    <Button
      nativeButton={false}
      render={
        <Link
          search={transactionHistorySearchSchema.parse(search)}
          to="/stock-management/transaction-history"
        />
      }
      size="sm"
      variant="outline"
    >
      <ChevronLeftIcon className="rtl:rotate-180" data-icon="inline-start" />
      {t('stock-event.back')}
    </Button>
  );
  if (
    !isNotFound(props.error) &&
    !(isAxiosError(props.error) && props.error.response?.status === 400)
  ) {
    return (
      <ErrorFallback
        {...props}
        back={back}
        description={t('stock-event.error-description')}
        title={t('stock-event.error-title')}
      />
    );
  }
  return (
    <Workspace>
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>
              <h1>{t('stock-event.not-found-title')}</h1>
            </EmptyTitle>
            <EmptyDescription>{t('stock-event.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{back} </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
