import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import {
  APPROVAL_HIDEABLE_COLUMNS,
  ApprovalTable,
  ApprovalTableSkeleton,
} from '@/features/buq/components/approval-table';
import { ApproveSummary, ApproveSummarySkeleton } from '@/features/buq/components/approve-summary';
import type { BuqListProps, BuqListSearch } from '@/features/buq/lib/search';
import { useCardView } from '@/hooks/use-card-view';

const VISIBILITY_KEY = 'buq.approve.column-visibility';

function useApprovalView() {
  const { t } = useTranslation();
  const { measure, cards, columnView, layout } = useCardView(
    APPROVAL_HIDEABLE_COLUMNS,
    VISIBILITY_KEY,
  );
  const view = (disabled: boolean) => (
    <DataTableToolbar align="end">
      <div className="flex-1 @2xl/main:flex-none">
        <DataTableViewOptions
          columns={APPROVAL_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          disabled={disabled}
          layout={layout}
          onReset={columnView.onReset}
          onVisibilityChange={columnView.onVisibilityChange}
          size="lg"
          visibility={columnView.visibility}
        />
      </div>
    </DataTableToolbar>
  );
  return { measure, cards, visibility: columnView.visibility, view };
}

export function ApproveBuq({
  programId,
  search,
  onSearchChange,
}: BuqListProps & { programId: string }) {
  const { t } = useTranslation();
  const { measure, cards, visibility, view } = useApprovalView();
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
      <div className="flex flex-col gap-4">
        {view(false)}
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <ListError
              description={t('buq.approve.list-error')}
              error={error}
              reset={reset}
              title={t('buq.list-error-title')}
            />
          )}
          pendingFallback={
            <ApprovalTableSkeleton cards={cards} search={search} visibility={visibility} />
          }
          resetKey={programId}
        >
          <ApprovalTable
            cards={cards}
            onSearchChange={onSearchChange}
            programId={programId}
            search={search}
            visibility={visibility}
          />
        </QueryBoundary>
      </div>
    </div>
  );
}

export function ApproveBuqSkeleton({ search }: { search: BuqListSearch }) {
  const { measure, cards, visibility, view } = useApprovalView();
  return (
    <div aria-busy className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <ApproveSummarySkeleton />
      <div className="flex flex-col gap-4">
        {view(true)}
        <ApprovalTableSkeleton cards={cards} search={search} visibility={visibility} />
      </div>
    </div>
  );
}
