import { createFileRoute } from '@tanstack/react-router';
import { MessageSquareXIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { rejectionReasonsOptions } from '@/features/reference-data/api/queries';
import {
  RejectionReasonsTable,
  RejectionReasonsTableSkeleton,
} from '@/features/rejection-reasons/components/rejection-reasons-table';
import { RejectionReasonsToolbar } from '@/features/rejection-reasons/components/rejection-reasons-toolbar';
import {
  REJECTION_REASON_HIDEABLE_COLUMNS,
  type RejectionReasonsListSearch,
  type RejectionReasonsSearch,
  rejectionReasonsSearchSchema,
} from '@/features/rejection-reasons/lib/search';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const loadDialog = () =>
  import('@/features/rejection-reasons/components/rejection-reason-form-dialog');
const RejectionReasonFormDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.RejectionReasonFormDialog })),
);
const CLOSED_DIALOGS = { reason: undefined } satisfies Partial<RejectionReasonsSearch>;
const usePageCardView = () =>
  useCardView(REJECTION_REASON_HIDEABLE_COLUMNS, 'rejection-reasons.column-visibility');

export const Route = createFileRoute('/(protected)/_protected/administration/rejection-reasons')({
  validateSearch: rejectionReasonsSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    await requireRight(queryClient, RIGHTS.usersManage);
    queryClient.prefetchQuery({ ...rejectionReasonsOptions(), staleTime: 30 * 1000 });
  },
  pendingComponent: RejectionReasonsPagePending,
  component: RejectionReasonsPage,
});

function RejectionReasonsPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ reason: _reason, ...list }): RejectionReasonsListSearch => list,
    structuralSharing: true,
  });
  const target = Route.useSearch({ select: (search) => search.reason });
  const { measure, cards, columnView, layout } = usePageCardView();
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<RejectionReasonsSearch>(CLOSED_DIALOGS);
  const addReason = useCallback(() => openDialog({ reason: 'new' }), [openDialog]);
  const [dialogMounted, setDialogMounted] = useState(target !== undefined);
  if (target !== undefined && !dialogMounted) setDialogMounted(true);
  useEffect(() => {
    void loadDialog();
  }, []);

  return (
    <Workspace>
      <RejectionReasonsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <RejectionReasonsToolbar
            search={search}
            onSearchChange={updateSearch}
            columnView={columnView}
            layout={layout}
            onAdd={addReason}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                error={error}
                reset={reset}
                title={t('rejection-reasons.error-title')}
                description={t('rejection-reasons.error-description')}
              />
            )}
            pendingFallback={
              <RejectionReasonsTableSkeleton
                cards={cards}
                search={search}
                columnVisibility={columnView.visibility}
              />
            }
            resetKey="rejection-reasons"
          >
            <RejectionReasonsTable
              cards={cards}
              search={search}
              onSearchChange={updateSearch}
              columnVisibility={columnView.visibility}
              onAdd={addReason}
            />
          </QueryBoundary>
        </div>
        {dialogMounted && (
          <Suspense fallback={null}>
            <RejectionReasonFormDialog target={target} onClose={closeDialog} />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function RejectionReasonsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <MessageSquareXIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('nav.administration.rejection-reason')}</WorkspaceTitle>
        <WorkspaceDescription>{t('rejection-reasons.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function RejectionReasonsPagePending() {
  const { measure, cards, columnView } = usePageCardView();
  return (
    <Workspace>
      <RejectionReasonsHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <RejectionReasonsTableSkeleton
            cards={cards}
            columnVisibility={columnView.visibility}
            search={{}}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
