import { useSuspenseQueries } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, useNavigate } from '@tanstack/react-router';
import { ClipboardCheckIcon, InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { useOfflineFailure } from '@/components/app-shell/offline-notice';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DataTableSelectionBar,
  SelectionBarLabel,
} from '@/components/data-table/data-table-selection';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useFilterScoped } from '@/components/valid-assignments/selection';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  deploymentTimeZoneOptions,
  programsOptions,
  rolesOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { approvalListOptions, hasOnlineApprovalList } from '@/features/requisitions/api/queries';
import {
  APPROVAL_HIDEABLE_COLUMNS,
  ApprovalTable,
  ApprovalTableSkeleton,
} from '@/features/requisitions/components/approval-table';
import { ApprovalToolbar } from '@/features/requisitions/components/approval-toolbar';
import {
  offlineCopiesOptions,
  useOfflineCopies,
} from '@/features/requisitions/hooks/use-offline-copies';
import {
  APPROVAL_SORT,
  type ApprovalSearch,
  type ApprovalSelection,
  approvalProgramsMixed,
  approvalScope,
  approvalSearchSchema,
  approvalSelectedIds,
} from '@/features/requisitions/lib/approval-search';
import { prepareRequisitionAccess } from '@/features/requisitions/lib/offline-access';
import { returnState } from '@/features/requisitions/lib/requisition-return';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useFlag } from '@/lib/feature-flags';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { isOnline, useOnline } from '@/lib/online';
import { RIGHTS } from '@/lib/rights';
import { getSessionScope } from '@/lib/session-scope';
import { searchSort } from '@/lib/table-search';

const NOTHING_PICKED: ApprovalSelection = new Map();
export const Route = createFileRoute('/(protected)/_protected/requisitions/approve')({
  validateSearch: approvalSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    queryClient.prefetchQuery(offlineCopiesOptions());
    await prepareRequisitionAccess(queryClient);
    await requireRight(queryClient, RIGHTS.requisitionApprove);
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) return;
    if (isOnline() || !hasOnlineApprovalList(queryClient, search))
      queryClient.prefetchQuery(approvalListOptions(search));
    queryClient.prefetchQuery(userRecordOptions(userId));
    queryClient.prefetchQuery(rolesOptions());
    queryClient.prefetchQuery(programsOptions());
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
    return { userId };
  },
  component: ApprovalPage,
  pendingComponent: ApprovalPending,
});
function ApprovalHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ClipboardCheckIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('requisitions.approve.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('requisitions.approve.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
function ApprovalError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  const copies = useOfflineCopies();
  useOfflineFailure(props.error, props.reset);
  if (props.error instanceof LocalDataUnavailableError && copies?.length)
    return (
      <p role="note" className="text-muted-foreground text-sm">
        {t('requisitions.offline.filter-choices-missing')}
      </p>
    );
  return (
    <ListError
      {...props}
      title={t('requisitions.approve.error-title')}
      description={t('requisitions.approve.error-description')}
    />
  );
}
function ApprovalPrograms({
  userId,
  children,
}: {
  userId: string;
  children: (programs: { id: string; name?: string | null }[]) => ReactNode;
}) {
  const [{ data: user }, { data: roles }, { data: programs }] = useSuspenseQueries({
    queries: [userRecordOptions(userId), rolesOptions(), programsOptions()],
  });
  const approvers = new Set(
    roles
      .filter((role) => role.rights.some((right) => right.name === RIGHTS.requisitionApprove))
      .map(({ id }) => id),
  );
  const ids = new Set(
    user.roleAssignments
      .filter((assignment) => approvers.has(assignment.roleId))
      .map(({ programId }) => programId),
  );
  return children(
    programs
      .filter(({ id }) => ids.has(id))
      .toSorted((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
  );
}
function ApprovalPending() {
  return <ApprovalLayout pending />;
}
function ApprovalPage() {
  const data = Route.useLoaderData();
  return data ? <ApprovalLayout userId={data.userId} /> : null;
}
function ApprovalLayout({ userId, pending = false }: { userId?: string; pending?: boolean }) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { updateSearch } = useSearchNavigation<ApprovalSearch>({});
  const view = useCardView(APPROVAL_HIDEABLE_COLUMNS, 'requisitions.approve.column-visibility');
  const batch = useFlag('BATCH_APPROVE_SCREEN');
  const online = useOnline();
  const scope = approvalScope(search, online);
  const [picked, setPicked] = useFilterScoped(scope, NOTHING_PICKED);
  const [mixed, setMixed] = useFilterScoped(scope, false);
  const navigate = useNavigate();
  const sort = searchSort(search, APPROVAL_SORT, updateSearch);
  const viewSelected = () => {
    if (approvalProgramsMixed([...picked.values()])) setMixed(true, scope);
    else
      void navigate({
        to: '/requisitions/approve/batch',
        search: {
          ids: approvalSelectedIds(picked).join(','),
          program: [...picked.values()][0]?.programId,
        },
        state: {
          ...returnState({ to: '/requisitions/approve', search }),
          requisitionBatchSession: getSessionScope(),
          requisitionBatchRecords: [...picked.values()].flatMap((value) =>
            value.record ? [value.record] : [],
          ),
          requisitionBatchLabels: Object.fromEntries(
            [...picked].map(([id, value]) => [id, value.label]),
          ),
        },
      });
  };
  const columnsMenu = (
    <DataTableViewOptions
      size="lg"
      disabled={pending}
      layout={view.layout}
      columns={APPROVAL_HIDEABLE_COLUMNS.map(({ id, labelKey }) => ({ id, label: t(labelKey) }))}
      onReset={view.columnView.onReset}
      onVisibilityChange={view.columnView.onVisibilityChange}
      visibility={view.columnView.visibility}
      sort={{
        ...sort,
        columns: [{ id: 'authorizedDate', label: t('requisitions.approve.date-authorized') }],
      }}
    />
  );
  const toolbar = (programs?: { id: string; name?: string | null }[]) => (
    <ApprovalToolbar
      search={search}
      programs={programs}
      disabled={pending}
      view={columnsMenu}
      onFilterChange={updateSearch}
      newestFirst={sort.value.desc}
      onOrderChange={(desc) => sort.onValueChange({ ...sort.value, desc })}
    />
  );
  const skeleton = (
    <ApprovalTableSkeleton
      cards={view.cards}
      columns={view.columnView.visibility}
      search={search}
      batch={batch}
    />
  );
  return (
    <>
      <Workspace>
        <ApprovalHeader />
        <WorkspaceContent>
          <div className="flex flex-col gap-4" ref={view.measure}>
            {batch && (
              <Alert variant="info">
                <InfoIcon />
                <AlertDescription>{t('requisitions.approve.note')}</AlertDescription>
              </Alert>
            )}
            {userId ? (
              <QueryBoundary
                resetKey={userId}
                pendingFallback={toolbar()}
                errorComponent={ApprovalError}
              >
                <ApprovalPrograms userId={userId}>{toolbar}</ApprovalPrograms>
              </QueryBoundary>
            ) : (
              toolbar()
            )}
            {pending ? (
              skeleton
            ) : (
              <QueryBoundary
                resetKey={JSON.stringify(search)}
                pendingFallback={skeleton}
                errorComponent={ApprovalError}
              >
                <ApprovalTable
                  cards={view.cards}
                  columns={view.columnView.visibility}
                  search={search}
                  onSearchChange={updateSearch}
                  batch={batch}
                  picked={picked}
                  onSelection={setPicked}
                />
              </QueryBoundary>
            )}
            {mixed && (
              <InvalidSubmitDialog
                open
                title={t('requisitions.approve.select-mixed-title')}
                description={t('requisitions.approve.select-mixed-description')}
                closeLabel={t('dialog.close')}
                onOpenChange={(open) => {
                  if (!open) setMixed(false, scope);
                }}
              />
            )}
          </div>
        </WorkspaceContent>
      </Workspace>
      {batch && (
        <DataTableSelectionBar
          placement="footer"
          count={picked.size}
          onClear={() => setPicked(NOTHING_PICKED, scope)}
        >
          <Button size="lg" disabled={pending} onClick={viewSelected}>
            <SelectionBarLabel
              full={t('requisitions.approve.view-selected')}
              short={t('requisitions.approve.view-selected-short')}
            />
          </Button>
        </DataTableSelectionBar>
      )}
    </>
  );
}
