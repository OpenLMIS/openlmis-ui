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
  return useCardView(APPROVAL_HIDEABLE_COLUMNS, VISIBILITY_KEY);
}

function ApprovalViewMenu({
  view,
  disabled = false,
}: {
  view: ReturnType<typeof useApprovalView>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <DataTableToolbar align="end">
      <div className="flex-1 @2xl/main:flex-none">
        <DataTableViewOptions
          columns={APPROVAL_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({
            id,
            label: t(labelKey),
          }))}
          disabled={disabled}
          layout={view.layout}
          onReset={view.columnView.onReset}
          onVisibilityChange={view.columnView.onVisibilityChange}
          size="lg"
          visibility={view.columnView.visibility}
        />
      </div>
    </DataTableToolbar>
  );
}

export function ApproveBuq({
  programId,
  search,
  onSearchChange,
}: BuqListProps & { programId: string }) {
  const { t } = useTranslation();
  const view = useApprovalView();
  const { measure, cards } = view;
  const visibility = view.columnView.visibility;
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
        <ApprovalViewMenu view={view} />
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
  const view = useApprovalView();
  const { measure, cards } = view;
  const visibility = view.columnView.visibility;
  return (
    <div aria-busy className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
      <ApproveSummarySkeleton />
      <div className="flex flex-col gap-4">
        <ApprovalViewMenu disabled view={view} />
        <ApprovalTableSkeleton cards={cards} search={search} visibility={visibility} />
      </div>
    </div>
  );
}
