import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { ApprovalTable, ApprovalTableSkeleton } from '@/features/buq/components/approval-table';
import { ApproveSummary, ApproveSummarySkeleton } from '@/features/buq/components/approve-summary';
import type { BuqListProps, BuqListSearch } from '@/features/buq/lib/search';
import { useCardLayout } from '@/hooks/use-card-view';

export function ApproveBuq({
  programId,
  search,
  onSearchChange,
}: BuqListProps & { programId: string }) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <ListError
            description={t('buq.approve.summary-error')}
            error={error}
            reset={reset}
            title={t('buq.approve.summary-error-title')}
          />
        )}
        pendingFallback={<ApproveSummarySkeleton />}
        resetKey={`${programId}-summary`}
      >
        <ApproveSummary programId={programId} />
      </QueryBoundary>
      <QueryBoundary
        errorComponent={({ error, reset }) => (
          <ListError
            description={t('buq.approve.list-error')}
            error={error}
            reset={reset}
            title={t('buq.list-error-title')}
          />
        )}
        pendingFallback={<ApprovalTableSkeleton cards={cards} search={search} />}
        resetKey={programId}
      >
        <ApprovalTable
          cards={cards}
          onSearchChange={onSearchChange}
          programId={programId}
          search={search}
        />
      </QueryBoundary>
    </div>
  );
}

export function ApproveBuqSkeleton({ search }: { search: BuqListSearch }) {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div aria-busy className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <ApproveSummarySkeleton />
      <ApprovalTableSkeleton cards={cards} search={search} />
    </div>
  );
}
