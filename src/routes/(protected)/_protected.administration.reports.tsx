import { createFileRoute } from '@tanstack/react-router';
import { ChartNoAxesCombinedIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requireRouteRights } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { dashboardReportsAdminOptions } from '@/features/dashboard-reports/api/queries';
import {
  DashboardReportsTable,
  DashboardReportsTableSkeleton,
} from '@/features/dashboard-reports/components/dashboard-reports-table';
import { DashboardReportsToolbar } from '@/features/dashboard-reports/components/dashboard-reports-toolbar';
import {
  type DashboardReportsSearch,
  dashboardReportsSearchSchema,
} from '@/features/dashboard-reports/lib/search';
import type { ManagedDashboardReport } from '@/features/dashboard-reports/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { RIGHTS } from '@/lib/rights';

const ReportFormDialog = lazy(() =>
  import('@/features/dashboard-reports/components/report-form-dialog').then((module) => ({
    default: module.ReportFormDialog,
  })),
);
const DeleteReportDialog = lazy(() =>
  import('@/features/dashboard-reports/components/delete-report-dialog').then((module) => ({
    default: module.DeleteReportDialog,
  })),
);

const CLOSED_DIALOGS = {
  report: undefined,
  delete: undefined,
} satisfies Partial<DashboardReportsSearch>;

const noop = () => {};

export const Route = createFileRoute('/(protected)/_protected/administration/reports')({
  staticData: { rights: [RIGHTS.reportsManage] },
  validateSearch: dashboardReportsSearchSchema,
  loader: async ({ route, context: { queryClient } }) => {
    await requireRouteRights(queryClient, route);
    queryClient.prefetchQuery(dashboardReportsAdminOptions());
  },
  pendingComponent: DashboardReportsPagePending,
  component: DashboardReportsPage,
});

function DashboardReportsPage() {
  const { t } = useTranslation();
  const userId = useLoginData((state) => state.referenceDataUserId) ?? '';
  const search = Route.useSearch({
    select: ({ report: _report, delete: _delete, ...list }): DashboardReportsSearch => list,
    structuralSharing: true,
  });
  const target = Route.useSearch({ select: (search) => search.report });
  const deleting = Route.useSearch({
    select: (search) => (search.report ? undefined : search.delete),
  });
  const dialogOpen = target !== undefined || deleting !== undefined;
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<DashboardReportsSearch>(CLOSED_DIALOGS);
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const addButton = useRef<HTMLButtonElement>(null);
  const formOpener = useRef<HTMLButtonElement | null>(null);
  const deleteOpener = useRef<HTMLButtonElement | null>(null);
  const [deleteHint, setDeleteHint] = useState<ManagedDashboardReport>();
  const [previousDelete, setPreviousDelete] = useState(deleting);
  if (deleting !== previousDelete) {
    setPreviousDelete(deleting);
    if (deleting !== deleteHint?.id) setDeleteHint(undefined);
  }
  const [formMounted, setFormMounted] = useState(target !== undefined);
  const [deleteMounted, setDeleteMounted] = useState(deleting !== undefined);
  if (target !== undefined && !formMounted) setFormMounted(true);
  if (deleting !== undefined && !deleteMounted) setDeleteMounted(true);
  const add = useCallback(
    (opener: HTMLButtonElement) => {
      formOpener.current = opener;
      void openDialog({ report: 'new' });
    },
    [openDialog],
  );
  const edit = useCallback(
    (row: ManagedDashboardReport, opener: HTMLButtonElement) => {
      formOpener.current = opener;
      void openDialog({ report: row.id });
    },
    [openDialog],
  );
  const remove = useCallback(
    (row: ManagedDashboardReport, opener: HTMLButtonElement) => {
      deleteOpener.current = opener;
      setDeleteHint(row);
      void openDialog({ delete: row.id });
    },
    [openDialog],
  );

  return (
    <Workspace>
      <DashboardReportsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <DashboardReportsToolbar
            addRef={addButton}
            layout={cards ? 'cards' : 'table'}
            onAdd={add}
            onSortChange={updateSearch}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('dashboard-reports.error-description')}
                error={error}
                reset={reset}
                title={t('dashboard-reports.error-title')}
              />
            )}
            pendingFallback={<DashboardReportsTableSkeleton cards={cards} search={search} />}
            resetKey={JSON.stringify(search)}
          >
            <DashboardReportsTable
              cards={cards}
              onAdd={add}
              dialogOpen={dialogOpen}
              onDelete={remove}
              onEdit={edit}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {formMounted && (
          <Suspense fallback={null}>
            <ReportFormDialog
              addButton={addButton}
              userId={userId}
              onClose={closeDialog}
              opener={formOpener}
              target={target}
            />
          </Suspense>
        )}
        {deleteMounted && (
          <Suspense fallback={null}>
            <DeleteReportDialog
              addButton={addButton}
              hint={deleteHint}
              onClose={closeDialog}
              opener={deleteOpener}
              target={deleting}
            />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function DashboardReportsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ChartNoAxesCombinedIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('nav.administration.reports')}</WorkspaceTitle>
        <WorkspaceDescription>{t('dashboard-reports.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function DashboardReportsPagePending() {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <Workspace>
      <DashboardReportsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <DashboardReportsToolbar
            disabled
            layout={cards ? 'cards' : 'table'}
            onAdd={noop}
            onSortChange={noop}
            search={{}}
          />
          <DashboardReportsTableSkeleton cards={cards} search={{}} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
