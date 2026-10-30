import { useSuspenseQueries } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router';
import { ClipboardCheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DataTableSelectionBar,
  SelectionBarLabel,
} from '@/components/data-table/data-table-selection';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { InvalidSubmitDialog } from '@/components/display/invalid-submit-dialog';
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
import { approvalListOptions } from '@/features/requisitions/api/queries';
import {
  APPROVAL_HIDEABLE_COLUMNS,
  ApprovalTable,
  ApprovalTableSkeleton,
} from '@/features/requisitions/components/approval-table';
import { ApprovalToolbar } from '@/features/requisitions/components/approval-toolbar';
import {
  APPROVAL_SORT,
  type ApprovalSearch,
  type ApprovalSelection,
  approvalScope,
  approvalSearchSchema,
  approvalSelectionError,
} from '@/features/requisitions/lib/approval-search';
import { useBackToLegacy } from '@/hooks/use-back-to-legacy';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useFlag } from '@/lib/feature-flags';
import { RIGHTS } from '@/lib/rights';
import { searchSort } from '@/lib/table-search';

const NOTHING_PICKED: ApprovalSelection = new Map();
export const Route = createFileRoute('/(protected)/_protected/requisitions/approve')({
  validateSearch: approvalSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context: { queryClient }, deps: { search } }) => {
    await requireRight(queryClient, RIGHTS.requisitionApprove);
    const userId = useLoginData.getState().referenceDataUserId;
    if (!userId) return;
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
  return (
    <ListError
      {...props}
      title={t('requisitions.view.error-title')}
      description={t('requisitions.view.error-description')}
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
  const scope = approvalScope(search);
  const [picked, setPicked] = useFilterScoped(scope, NOTHING_PICKED);
  const [error, setError] = useFilterScoped<'none' | 'mixed' | null>(scope, null);
  const legacy = useBackToLegacy(
    `#!/requisitions/batchApproval?ids=${[...picked.keys()].map(encodeURIComponent).join(',')}`,
  );
  const viewSelected = () => {
    const problem = approvalSelectionError([...picked.values()]);
    if (problem) setError(problem, scope);
    else legacy.onClick();
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
        ...searchSort(search, APPROVAL_SORT, updateSearch),
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
    <Workspace>
      <ApprovalHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4" ref={view.measure}>
          {batch && (
            <p className="text-muted-foreground text-sm">{t('requisitions.approve.note')}</p>
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
          {batch && (
            <>
              {legacy.available && !picked.size && (
                <div>
                  <Button size="lg" variant="outline" disabled={pending} onClick={viewSelected}>
                    {t('requisitions.approve.view-selected')}
                  </Button>
                </div>
              )}
              <DataTableSelectionBar
                count={picked.size}
                onClear={() => setPicked(NOTHING_PICKED, scope)}
              >
                {legacy.available && (
                  <Button size="sm" onClick={viewSelected}>
                    <SelectionBarLabel
                      full={t('requisitions.approve.view-selected')}
                      short={t('requisitions.approve.view-selected-short')}
                    />
                  </Button>
                )}
              </DataTableSelectionBar>
            </>
          )}
          {error && (
            <InvalidSubmitDialog
              open
              title={t(`requisitions.approve.select-${error}-title`)}
              description={t(`requisitions.approve.select-${error}-description`)}
              closeLabel={t('dialog.close')}
              onOpenChange={(open) => {
                if (!open) setError(null, scope);
              }}
            />
          )}
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
