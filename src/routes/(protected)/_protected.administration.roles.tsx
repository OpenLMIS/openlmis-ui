import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { ShieldIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableError } from '@/components/data-table/data-table';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { NoAccess } from '@/components/no-access-page';
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
import { rightsOptions } from '@/features/auth/api/queries';
import { isForbidden, requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { rolesOptions } from '@/features/reference-data/api/queries';
import { roleTypeOf } from '@/features/reference-data/lib/roles';
import type { RightType } from '@/features/reference-data/lib/types';
import { rightsByTypeOptions, roleDetailOptions } from '@/features/roles/api/queries';
import { RolesTable, RolesTableSkeleton } from '@/features/roles/components/roles-table';
import { RolesToolbar } from '@/features/roles/components/roles-toolbar';
import {
  ROLE_HIDEABLE_COLUMNS,
  type RolesSearch,
  rolesSearchSchema,
} from '@/features/roles/lib/search';
import { useStoredState } from '@/hooks/use-stored-state';
import type { SearchUpdate } from '@/lib/table-search';

// Their own chunk: the list paints without the forms, and the chunk is fetched right after.
const loadRoleDialogs = () => import('@/features/roles/components/role-dialogs');
const RoleDialogs = lazy(() =>
  loadRoleDialogs().then((module) => ({ default: module.RoleDialogs })),
);

/** Every dialog closed; the params a dialog adds to the list's URL. */
const CLOSED_DIALOGS = {
  role: undefined,
  roleType: undefined,
  rights: undefined,
} satisfies Partial<RolesSearch>;

// Legacy reloads the list on every visit; another admin may have changed a role since.
const LIST_FRESH_FOR = 30 * 1000;

export const Route = createFileRoute('/(protected)/_protected/administration/roles')({
  validateSearch: rolesSearchSchema,
  loaderDeps: ({ search }) => ({ role: search.role, roleType: search.roleType }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.usersManage);
    queryClient.prefetchQuery({ ...rolesOptions(), staleTime: LIST_FRESH_FOR });
    const listed =
      deps.role && deps.role !== 'new'
        ? queryClient.getQueryData(rolesOptions().queryKey)?.find((role) => role.id === deps.role)
        : undefined;
    if (deps.role && deps.role !== 'new') queryClient.prefetchQuery(roleDetailOptions(deps.role));
    // A saved role's type is in the list already, so its rights load beside the role, not after it.
    const type = deps.roleType ?? roleTypeOf(listed);
    if (type) queryClient.prefetchQuery(rightsByTypeOptions(type));
  },
  pendingComponent: RolesPagePending,
  component: RolesPage,
});

const columnChoicesSchema = z.record(z.string(), z.boolean());

/** What the signed-in user's rights let them do here; the page itself needs Manage Users. */
function useRoleAccess() {
  const userId = useLoginData((state) => state.referenceDataUserId) ?? '';
  const { data: rights } = useSuspenseQuery(rightsOptions(userId));
  const canViewRights = rights.has(RIGHTS.rightsView);
  // Picking rights needs View Rights too, so editing without it would fail half way.
  const canEdit = canViewRights && rights.has(RIGHTS.userRolesManage);
  return { userId, canViewRights, canEdit };
}

function RolesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { userId, canViewRights, canEdit } = useRoleAccess();
  // Without the dialogs' params, and shared structurally, so opening a dialog leaves the table alone.
  const search = Route.useSearch({
    select: ({ role: _role, roleType: _roleType, rights: _rights, ...list }): RolesSearch => list,
    structuralSharing: true,
  });
  const dialogs = Route.useSearch({
    // One dialog at a time: a link that names both opens the role.
    select: ({ role, roleType, rights }) => ({
      role: role ? { role, roleType } : undefined,
      rights: role === undefined ? rights : undefined,
    }),
    structuralSharing: true,
  });
  const anyDialogOpen = dialogs.role !== undefined || dialogs.rights !== undefined;
  const navigate = Route.useNavigate();
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    ROLE_HIDEABLE_COLUMNS,
    useStoredState('roles.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );

  // Typing in a filter replaces the history entry; paging and sorting add one, so Back steps through them.
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
  const router = useRouter();
  // Opening marks the entry it pushes, so closing steps Back to the list, even after Forward reopened it.
  const openDialog = useCallback(
    (params: Partial<RolesSearch>) =>
      navigate({
        search: (previous) => ({ ...previous, ...CLOSED_DIALOGS, ...params }),
        state: (previous) => ({ ...previous, dialogOpenedHere: true }),
      }),
    [navigate],
  );
  const closeDialog = useCallback(() => {
    if (router.state.location.state.dialogOpenedHere) router.history.back();
    else updateSearch(CLOSED_DIALOGS, true);
  }, [router, updateSearch]);
  // Moving between the dialog's steps keeps one history entry, so Back still closes it.
  const setRoleType = useCallback(
    (roleType: RightType | undefined) =>
      navigate({
        search: (previous) => ({ ...previous, roleType }),
        state: (previous) => previous,
        replace: true,
      }),
    [navigate],
  );
  const editRole = useCallback((role: string) => openDialog({ role }), [openDialog]);
  const viewRights = useCallback((rights: string) => openDialog({ rights }), [openDialog]);
  // Refetched rather than invalidated, so the rights check on closing the dialog never waits for it.
  const reloadOwnRights = useCallback(
    () => queryClient.refetchQueries({ queryKey: rightsOptions(userId).queryKey }),
    [queryClient, userId],
  );
  const [dialogsMounted, setDialogsMounted] = useState(anyDialogOpen);
  if (anyDialogOpen && !dialogsMounted) setDialogsMounted(true);
  useEffect(() => {
    void loadRoleDialogs();
  }, []);

  const rowActions = {
    onEdit: canEdit ? editRole : undefined,
    onViewRights: canViewRights ? viewRights : undefined,
  };

  return (
    <Workspace>
      <RolesHeader />
      <WorkspaceContent>
        {/* Measured, because the room for columns depends on the sidebar as well as the window. */}
        <div className="flex flex-col gap-4 lg:gap-6" ref={measureContent}>
          <RolesToolbar
            columnView={columnView}
            onCreate={canEdit ? () => openDialog({ role: 'new' }) : undefined}
            onFilterChange={(patch) => updateSearch(patch, true)}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) =>
              isForbidden(error) ? (
                <NoAccess />
              ) : (
                <DataTableError
                  description={t('roles.error-description')}
                  onRetry={reset}
                  title={t('roles.error-title')}
                />
              )
            }
            pendingFallback={
              <RolesTableSkeleton
                columnVisibility={columnView.visibility}
                search={search}
                {...rowActions}
              />
            }
            resetKey="roles"
          >
            <RolesTable
              columnVisibility={columnView.visibility}
              onSearchChange={updateSearch}
              search={search}
              {...rowActions}
            />
          </QueryBoundary>
        </div>
        {dialogsMounted && (
          <Suspense fallback={null}>
            <RoleDialogs
              canEdit={canEdit}
              onBackToTypes={() => setRoleType(undefined)}
              onClose={closeDialog}
              onPickType={setRoleType}
              onSaved={reloadOwnRights}
              rightsRoleId={canViewRights ? dialogs.rights : undefined}
              role={dialogs.role}
            />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function RolesHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <ShieldIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('roles.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('roles.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

/** While the rights check runs on a first visit: the page's header over a table skeleton. */
function RolesPagePending() {
  return (
    <Workspace>
      <RolesHeader />
      <WorkspaceContent>
        <RolesTableSkeleton columnVisibility={{}} search={{}} />
      </WorkspaceContent>
    </Workspace>
  );
}
