import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
  useBlocker,
  useRouter,
} from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { CopyPlusIcon, PlusIcon, ShieldIcon, UserXIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DataTableError, DataTableToolbar } from '@/components/data-table/data-table';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { QueryBoundary } from '@/components/query-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { rightsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  minimalFacilitiesOptions,
  programsOptions,
  rolesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import { updateUserRoles } from '@/features/users/api/api';
import { userDetailsOptions } from '@/features/users/api/queries';
import { ErrorAlert, serverMessage } from '@/features/users/components/dialog-parts';
import { DiscardChangesDialog } from '@/features/users/components/discard-changes-dialog';
import {
  RoleAssignmentsTable,
  RoleAssignmentsTableSkeleton,
} from '@/features/users/components/role-assignments-table';
import {
  assignmentKey,
  countByType,
  ROLE_TABS,
  type RoleRow,
  type RoleTab,
  toRoleRows,
} from '@/features/users/lib/role-assignments';
import {
  CLOSED_ROLE_DIALOGS,
  type RolesSearch,
  rolesSearchSchema,
  TAB_RESET,
} from '@/features/users/lib/roles-search';
import type { RoleAssignment, UserDetails } from '@/features/users/lib/types';
import { useRoleDraft } from '@/features/users/lib/use-role-draft';
import { useRoleLookups } from '@/features/users/lib/use-role-lookups';
import { queryKeys } from '@/lib/key-factory';
import type { SearchUpdate } from '@/lib/table-search';

// Their own chunk, fetched once the page has painted.
const loadRoleDialogs = () => import('@/features/users/components/role-dialogs');
const RoleDialogs = lazy(() =>
  loadRoleDialogs().then((module) => ({ default: module.RoleDialogs })),
);

export const Route = createFileRoute('/(protected)/_protected/administration/users_/$id/roles')({
  validateSearch: rolesSearchSchema,
  staticData: { crumbKey: 'users.roles' },
  loader: ({ context: { queryClient }, params }) => {
    queryClient.prefetchQuery(rolesOptions());
    queryClient.prefetchQuery(programsOptions());
    // Slow, so they start now and fill in the rows when they arrive.
    queryClient.prefetchQuery(supervisoryNodesOptions());
    queryClient.prefetchQuery(minimalFacilitiesOptions());
    void loadRoleDialogs();
    // A user that does not exist has no roles page, so the page waits for the user.
    return queryClient.ensureQueryData(userDetailsOptions(params.id));
  },
  pendingComponent: RolesPagePending,
  errorComponent: RolesPageError,
  component: UserRolesPage,
});

/** Too narrow for a column per name, so each row lists them under the role. */
const COMPACT_BELOW = 576;

function fullName(details: UserDetails) {
  return [details.user.firstName, details.user.lastName].filter(Boolean).join(' ');
}

function UserRolesPage() {
  const { id: userId } = Route.useParams();
  const { data: details } = useSuspenseQuery(userDetailsOptions(userId));
  // A different user starts a fresh draft.
  return <RolesEditor details={details} key={userId} />;
}

function RolesEditor({ details }: { details: UserDetails }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { user } = details;
  const signedInUserId = useLoginData((state) => state.referenceDataUserId);
  const draft = useRoleDraft(user.roleAssignments);
  const tab = ROLE_TABS.find((item) => item.id === (search.tab ?? 'supervision')) ?? ROLE_TABS[0];
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const updateSearch = useCallback(
    (update: Partial<RolesSearch> | SearchUpdate<RolesSearch>, replace = false) =>
      navigate({
        search: (previous) => ({
          ...previous,
          ...(typeof update === 'function' ? update(previous) : update),
        }),
        replace,
      }),
    [navigate],
  );
  // Opening marks the entry it pushes, so closing steps Back instead of stacking history.
  const openDialog = useCallback(
    (params: Partial<RolesSearch>) =>
      navigate({
        search: (previous) => ({ ...previous, ...CLOSED_ROLE_DIALOGS, ...params }),
        state: (previous) => ({ ...previous, dialogOpenedHere: true }),
      }),
    [navigate],
  );
  const closeDialog = useCallback(() => {
    if (router.state.location.state.dialogOpenedHere) router.history.back();
    else updateSearch(CLOSED_ROLE_DIALOGS, true);
  }, [router, updateSearch]);

  const save = useMutation({
    mutationFn: () => updateUserRoles(user.id, draft.draft),
    onSuccess: (saved) => {
      queryClient.setQueryData(userDetailsOptions(user.id).queryKey, (previous) =>
        previous ? { ...previous, user: saved } : previous,
      );
      draft.reset(saved.roleAssignments);
      toast.success(t('users.roles.saved', { username: user.username }));
      // Your own roles decide what this app shows you.
      if (user.id === signedInUserId) {
        void queryClient.invalidateQueries({ queryKey: rightsOptions(user.id).queryKey });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });

  // Tabs, dialogs and paging stay on this page; only leaving it can lose the draft.
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      draft.changes > 0 && current.pathname !== next.pathname && next.pathname !== '/login',
    enableBeforeUnload: () => draft.changes > 0,
    withResolver: true,
  });

  const removeRole = useCallback(
    (row: RoleRow) => {
      const { remove, add } = draft;
      remove(row.assignment);
      toast(t('users.roles.removed', { role: row.role ?? t('users.roles.unknown') }), {
        action: { label: t('users.roles.undo'), onClick: () => add(row.assignment) },
      });
    },
    [draft, t],
  );
  const viewRights = useCallback((roleId: string) => openDialog({ rights: roleId }), [openDialog]);

  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ShieldIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>
            {t('users.roles.title', { name: fullName(details) || user.username })}
          </WorkspaceTitle>
          <WorkspaceDescription>
            {t('users.roles.description', { username: user.username })}
          </WorkspaceDescription>
        </WorkspaceHeading>
        <WorkspaceActions>
          <Button onClick={() => openDialog({ dialog: 'import' })} size="lg" variant="outline">
            <CopyPlusIcon data-icon="inline-start" />
            {t('users.roles.import')}
          </Button>
          {draft.changes > 0 && (
            <Button
              disabled={save.isPending}
              onClick={() => setConfirmingDiscard(true)}
              size="lg"
              variant="outline"
            >
              {t('users.roles.discard')}
            </Button>
          )}
          <Button
            aria-describedby="unsaved-changes"
            disabled={draft.changes === 0 || save.isPending}
            onClick={() => save.mutate()}
            size="lg"
          >
            {t('users.roles.save')}
            {draft.changes > 0 && (
              <Badge variant="secondary">
                <span id="unsaved-changes">
                  <span aria-hidden="true">{draft.changes}</span>
                  <span className="sr-only">
                    {t('users.roles.unsaved-count', { count: draft.changes })}
                  </span>
                </span>
              </Badge>
            )}
          </Button>
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div className="flex flex-col gap-4 lg:gap-6" ref={measureContent}>
          {save.isError && (
            <ErrorAlert
              description={serverMessage(save.error) ?? t('users.roles.save-error')}
              title={t('users.roles.save-error-title')}
            />
          )}
          <RoleTabs
            compact={contentWidth !== undefined && contentWidth < COMPACT_BELOW}
            draft={draft.draft}
            homeFacilityId={user.homeFacilityId}
            onAdd={() => openDialog({ dialog: 'add' })}
            onRemove={removeRole}
            onSearchChange={updateSearch}
            onViewRights={viewRights}
            saved={user.roleAssignments}
            search={search}
            tab={tab}
          />
        </div>
        <Suspense fallback={null}>
          <RoleDialogs
            addType={search.dialog === 'add' ? tab.type : undefined}
            draft={draft.draft}
            hasHomeFacility={Boolean(user.homeFacilityId)}
            importOpen={search.dialog === 'import'}
            onAdd={draft.add}
            onClose={closeDialog}
            onImport={(assignments, fromUsername) => {
              const { added } = draft.merge(assignments);
              toast.success(
                t('users.roles.import.imported', { count: added, username: fromUsername }),
              );
            }}
            rightsRoleId={search.rights}
            userId={user.id}
            username={user.username}
          />
        </Suspense>
        <DiscardChangesDialog
          changes={draft.changes}
          onDiscard={() => {
            draft.reset();
            setConfirmingDiscard(false);
            blocker.proceed?.();
          }}
          onKeepEditing={() => {
            setConfirmingDiscard(false);
            blocker.reset?.();
          }}
          open={confirmingDiscard || blocker.status === 'blocked'}
          username={user.username}
        />
      </WorkspaceContent>
    </Workspace>
  );
}

type RoleTabsProps = {
  tab: RoleTab;
  draft: RoleAssignment[];
  saved: RoleAssignment[];
  homeFacilityId: string | null | undefined;
  compact: boolean;
  search: RolesSearch;
  onSearchChange: (
    update: Partial<RolesSearch> | SearchUpdate<RolesSearch>,
    replace?: boolean,
  ) => void;
  onAdd: () => void;
  onRemove: (row: RoleRow) => void;
  onViewRights: (roleId: string) => void;
};

function RoleTabs({ tab, draft, search, onSearchChange, compact, ...props }: RoleTabsProps) {
  const { t } = useTranslation();
  // Counted once the roles are known, which says which tab an assignment belongs on.
  const { data: counts } = useQuery({
    ...rolesOptions(),
    select: (roles) => countByType(draft, new Map(roles.map((role) => [role.id, role]))),
  });

  return (
    <Tabs
      onValueChange={(value: RoleTab['id']) =>
        onSearchChange({ ...TAB_RESET, tab: value === 'supervision' ? undefined : value })
      }
      value={tab.id}
    >
      {/* Scrolls sideways on a phone rather than wrapping four tabs onto two rows. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <TabsList aria-label={t('users.roles.tabs-label')}>
          {ROLE_TABS.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {t(item.labelKey)}
              {counts && <Badge variant="secondary">{counts[item.type]}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {ROLE_TABS.map((item) => (
        <TabsContent key={item.id} value={item.id}>
          {item.id === tab.id && (
            <div className="flex flex-col gap-4">
              <DataTableToolbar>
                <div className="w-full @xl/main:w-72">
                  <DataTableSearch
                    label={t('users.roles.search-label')}
                    onValueChange={(q) => onSearchChange({ q, page: undefined }, true)}
                    placeholder={t('users.roles.search')}
                    value={search.q ?? ''}
                  />
                </div>
                <div className="ms-auto">
                  <Button onClick={props.onAdd}>
                    <PlusIcon data-icon="inline-start" />
                    {t('users.roles.add')}
                  </Button>
                </div>
              </DataTableToolbar>
              <QueryBoundary
                errorComponent={({ reset }) => (
                  <DataTableError
                    description={t('users.roles.error-description')}
                    onRetry={reset}
                    title={t('users.roles.error-title')}
                  />
                )}
                pendingFallback={
                  <RoleAssignmentsTableSkeleton compact={compact} search={search} tab={item} />
                }
                resetKey={item.id}
              >
                <TabTable
                  compact={compact}
                  draft={draft}
                  onSearchChange={onSearchChange}
                  search={search}
                  tab={item}
                  {...props}
                />
              </QueryBoundary>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function TabTable({ draft, saved, homeFacilityId, tab, ...props }: RoleTabsProps) {
  const { lookups, pending } = useRoleLookups();
  const savedKeys = useMemo(() => new Set(saved.map(assignmentKey)), [saved]);
  const rows = useMemo(
    () => toRoleRows(draft, tab.type, { lookups, savedKeys, homeFacilityId }),
    [draft, tab.type, lookups, savedKeys, homeFacilityId],
  );
  return <RoleAssignmentsTable pending={pending} rows={rows} tab={tab} {...props} />;
}

/** While the user loads: the page's frame with placeholders where their name and roles go. */
function RolesPagePending() {
  const { t } = useTranslation();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <ShieldIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('users.roles')}</WorkspaceTitle>
          {/* Holds the line the user's description takes, so the header does not grow. */}
          <WorkspaceDescription>{'\u00a0'}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <div aria-busy className="flex flex-col gap-4">
          <div className="h-8 w-80 max-w-full">
            <Skeleton fill />
          </div>
          <RoleAssignmentsTableSkeleton compact={false} search={{}} tab={ROLE_TABS[0]} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function RolesPageError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const notFound = isAxiosError(error) && error.response?.status === 404;

  return (
    <Workspace>
      <WorkspaceContent>
        {notFound ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UserXIcon />
              </EmptyMedia>
              <EmptyTitle>{t('users.roles.not-found-title')}</EmptyTitle>
              <EmptyDescription>{t('users.roles.not-found-description')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                nativeButton={false}
                render={<Link to="/administration/users" />}
                variant="outline"
              >
                {t('users.roles.back')}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <DataTableError
            description={t('users.roles.error-description')}
            onRetry={() => {
              reset();
              void router.invalidate();
            }}
            title={t('users.roles.load-error-title')}
          />
        )}
      </WorkspaceContent>
    </Workspace>
  );
}
