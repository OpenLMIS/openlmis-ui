import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ShieldIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
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
import { rightsOptions } from '@/features/auth/api/queries';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { toRoleAccess } from '@/features/auth/lib/role-access';
import { useLoginData } from '@/features/auth/store/login-data';
import { rolesOptions } from '@/features/reference-data/api/queries';
import { ROLE_TYPES, roleTypeOf } from '@/features/reference-data/lib/roles';
import { rightsByTypeOptions, roleDetailOptions } from '@/features/roles/api/queries';
import { RolesTable, RolesTableSkeleton } from '@/features/roles/components/roles-table';
import { RolesToolbar } from '@/features/roles/components/roles-toolbar';
import {
  ROLE_HIDEABLE_COLUMNS,
  type RolesSearch,
  rolesSearchSchema,
} from '@/features/roles/lib/search';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

// Their own chunk: the list paints without the forms, and the chunk is fetched right after.
const loadRoleDialogs = () => import('@/features/roles/components/role-dialogs');
const RoleDialogs = lazy(() =>
  loadRoleDialogs().then((module) => ({ default: module.RoleDialogs })),
);

/** Every dialog closed; the params a dialog adds to the list's URL. */
const CLOSED_DIALOGS = {
  role: undefined,
  rights: undefined,
} satisfies Partial<RolesSearch>;

// Legacy reloads the list on every visit; another admin may have changed a role since.
const LIST_FRESH_FOR = 30 * 1000;

const usePageCardView = () => useCardView(ROLE_HIDEABLE_COLUMNS, 'roles.column-visibility');

export const Route = createFileRoute('/(protected)/_protected/administration/roles')({
  validateSearch: rolesSearchSchema,
  loaderDeps: ({ search }) => ({ role: search.role }),
  loader: async ({ context: { queryClient }, deps }) => {
    const rights = await requireRight(queryClient, RIGHTS.usersManage);
    queryClient.prefetchQuery({ ...rolesOptions(), staleTime: LIST_FRESH_FOR });
    // The dialog's data is only worth loading for someone who can edit.
    if (!toRoleAccess(rights).canEdit) return;
    if (deps.role === 'new') {
      // Every tab's rights, so switching the type never waits.
      for (const { type } of ROLE_TYPES) queryClient.prefetchQuery(rightsByTypeOptions(type));
    } else if (deps.role) {
      const roleId = deps.role;
      queryClient.prefetchQuery(roleDetailOptions(roleId));
      // A saved role's type is in the list, so its rights load beside the role, not after it.
      void queryClient.prefetchQuery(rolesOptions()).then(() => {
        const roles = queryClient.getQueryData(rolesOptions().queryKey);
        const type = roleTypeOf(roles?.find((role) => role.id === roleId));
        if (type) queryClient.prefetchQuery(rightsByTypeOptions(type));
      });
    }
  },
  pendingComponent: RolesPagePending,
  component: RolesPage,
});

function useRoleAccess() {
  const userId = useLoginData((state) => state.referenceDataUserId) ?? '';
  const { data: rights } = useSuspenseQuery(rightsOptions(userId));
  return { userId, ...toRoleAccess(rights) };
}

function RolesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { userId, canViewRights, canEdit } = useRoleAccess();
  // Without the dialogs' params, and shared structurally, so opening a dialog leaves the table alone.
  const search = Route.useSearch({
    select: ({ role: _role, rights: _rights, ...list }): RolesSearch => list,
    structuralSharing: true,
  });
  const dialogs = Route.useSearch({
    // One dialog at a time: a link that names both opens the role.
    select: ({ role, rights }) => ({
      role,
      rights: role === undefined ? rights : undefined,
    }),
    structuralSharing: true,
  });
  const anyDialogOpen = dialogs.role !== undefined || dialogs.rights !== undefined;
  const { measure, cards, columnView, layout } = usePageCardView();

  // Typing in a filter replaces the history entry; paging and sorting add one, so Back steps through them.
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<RolesSearch>(CLOSED_DIALOGS);
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
        <div className="flex flex-col gap-4 lg:gap-6" ref={measure}>
          <RolesToolbar
            columnView={columnView}
            layout={layout}
            onCreate={canEdit ? () => openDialog({ role: 'new' }) : undefined}
            onFilterChange={(patch) => updateSearch(patch, true)}
            onSortChange={updateSearch}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('roles.error-description')}
                error={error}
                reset={reset}
                title={t('roles.error-title')}
              />
            )}
            pendingFallback={
              <RolesTableSkeleton
                cards={cards}
                columnVisibility={columnView.visibility}
                search={search}
                {...rowActions}
              />
            }
            resetKey="roles"
          >
            <RolesTable
              cards={cards}
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
              onClose={closeDialog}
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
  const { measure, cards, columnView } = usePageCardView();
  return (
    <Workspace>
      <RolesHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <RolesTableSkeleton cards={cards} columnVisibility={columnView.visibility} search={{}} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
