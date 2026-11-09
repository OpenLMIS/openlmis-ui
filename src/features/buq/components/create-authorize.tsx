import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { preparedBuqsOptions } from '@/features/buq/api/queries';
import { BuqHeading, BuqHeadingSkeleton } from '@/features/buq/components/buq-heading';
import { ForecastsTable, ForecastsTableSkeleton } from '@/features/buq/components/forecasts-table';
import { useBuqPeriods } from '@/features/buq/components/use-buq-periods';
import type { BuqListSearch } from '@/features/buq/lib/search';
import type { NamedItem } from '@/features/buq/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';
import type { SearchChange } from '@/lib/table-search';

type ListSearchProps = { search: BuqListSearch; onSearchChange: SearchChange<BuqListSearch> };

export function CreateAuthorize({
  facility,
  program,
  search,
  onSearchChange,
}: ListSearchProps & { facility: NamedItem; program: NamedItem }) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <BuqHeading facility={facility} program={program} />
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <ListError
            description={t('buq.create.list-error')}
            error={error}
            reset={reset}
            title={t('buq.list-error-title')}
          />
        )}
        pendingFallback={<ForecastsTableSkeleton cards={cards} search={search} />}
        resetKey={facility.id}
      >
        <LoadedForecasts
          cards={cards}
          facility={facility}
          onSearchChange={onSearchChange}
          search={search}
        />
      </QueryBoundary>
    </div>
  );
}

function LoadedForecasts({
  facility,
  ...props
}: ListSearchProps & { facility: NamedItem; cards: boolean }) {
  const periods = useBuqPeriods();
  const { data: buqs } = useSuspenseQuery(preparedBuqsOptions(facility.id));
  return <ForecastsTable {...props} buqs={buqs} periods={periods} />;
}

export function CreateAuthorizeSkeleton({ search }: { search: BuqListSearch }) {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div aria-busy className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <BuqHeadingSkeleton />
      <ForecastsTableSkeleton cards={cards} search={search} />
    </div>
  );
}
