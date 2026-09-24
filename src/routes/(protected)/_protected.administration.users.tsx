import {
  createFileRoute,
  ErrorComponent,
  type ErrorComponentProps,
  useRouter,
} from '@tanstack/react-router';
import { UsersIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableError } from '@/components/data-table/data-table';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { NoAccessPage } from '@/components/no-access-page';
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
import { isForbidden, requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { minimalFacilitiesOptions } from '@/features/reference-data/api/queries';
import { userDetailsOptions, usersListOptions } from '@/features/users/api/queries';
import { UsersTable, UsersTableSkeleton } from '@/features/users/components/users-table';
import { UsersToolbar } from '@/features/users/components/users-toolbar';
import {
  toUsersQuery,
  USER_HIDEABLE_COLUMNS,
  type UsersSearch,
  usersSearchSchema,
} from '@/features/users/lib/search';
import { useStoredState } from '@/hooks/use-stored-state';
import type { SearchUpdate } from '@/lib/table-search';

// Their own chunk: the list paints without the forms, and the chunk is fetched right after.
const loadUserDialogs = () => import('@/features/users/components/user-dialogs');
const UserDialogs = lazy(() =>
  loadUserDialogs().then((module) => ({ default: module.UserDialogs })),
);

/** Every dialog closed; the params a dialog adds to the list's URL. */
const CLOSED_DIALOGS = {
  user: undefined,
  password: undefined,
  created: undefined,
} satisfies Partial<UsersSearch>;

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: extending the router's type needs interface merging.
  interface HistoryState {
    /** On an entry this page pushed to open a dialog, so closing it can step Back. */
    dialogOpenedHere?: boolean;
    /** The list's search when a user's roles were opened from it, so leaving them returns there. */
    usersListSearch?: UsersSearch;
  }
}

export const Route = createFileRoute('/(protected)/_protected/administration/users')({
  validateSearch: usersSearchSchema,
  loaderDeps: ({ search }) => ({
    query: toUsersQuery(search),
    user: search.user,
    password: search.password,
  }),
  // Managing users takes a right; checked before anything loads, since the list would only fail.
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.usersManage);
    queryClient.prefetchQuery(usersListOptions(deps.query));
    // A dialog's data starts with the navigation, not once the dialog has rendered.
    if (deps.user) queryClient.prefetchQuery(minimalFacilitiesOptions());
    const detailsFor = deps.user ? deps.user !== 'new' && deps.user : deps.password;
    if (detailsFor) queryClient.prefetchQuery(userDetailsOptions(detailsFor));
  },
  errorComponent: UsersPageError,
  component: UsersPage,
});

function UsersPageError(props: ErrorComponentProps) {
  return isForbidden(props.error) ? <NoAccessPage /> : <ErrorComponent {...props} />;
}

const columnChoicesSchema = z.record(z.string(), z.boolean());

function UsersPage() {
  const { t } = useTranslation();
  // Without the dialogs' params, and shared structurally, so opening a dialog leaves the table alone.
  const search = Route.useSearch({
    select: ({ user: _user, password: _password, created: _created, ...list }): UsersSearch => list,
    structuralSharing: true,
  });
  const dialogs = Route.useSearch({
    // One dialog at a time: a link that names both opens the user.
    select: ({ user, password, created }) => ({
      user,
      password:
        password && user === undefined
          ? { userId: password, created: created ?? false }
          : undefined,
    }),
    structuralSharing: true,
  });
  const anyDialogOpen = dialogs.user !== undefined || dialogs.password !== undefined;
  const navigate = Route.useNavigate();
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    USER_HIDEABLE_COLUMNS,
    useStoredState('users.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );
  const query = Route.useLoaderDeps({ select: (deps) => deps.query });

  // Typing in a filter replaces the history entry; paging and sorting add one, so Back steps through them.
  const updateSearch = useCallback(
    (update: Partial<UsersSearch> | SearchUpdate<UsersSearch>, replace = false) =>
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
    (params: Partial<UsersSearch>) =>
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
  // Setting a password takes the new user's place in history, keeping its mark, so Close still steps Back.
  const setNewUserPassword = useCallback(
    (userId: string) =>
      navigate({
        search: (previous) => ({ ...previous, ...CLOSED_DIALOGS, password: userId, created: true }),
        state: (previous) => previous,
        replace: true,
      }),
    [navigate],
  );
  const editUser = useCallback((user: string) => openDialog({ user }), [openDialog]);
  const resetPassword = useCallback((password: string) => openDialog({ password }), [openDialog]);
  // Mounted from the first open on, so a dialog can still animate closed.
  const [dialogsMounted, setDialogsMounted] = useState(anyDialogOpen);
  if (anyDialogOpen && !dialogsMounted) setDialogsMounted(true);
  useEffect(() => {
    void loadUserDialogs();
  }, []);

  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <UsersIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('users.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('users.description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        {/* Measured, because the room for columns depends on the sidebar as well as the window. */}
        <div className="flex flex-col gap-4 lg:gap-6" ref={measureContent}>
          <UsersToolbar
            columnView={columnView}
            onAdd={() => openDialog({ user: 'new' })}
            onFilterChange={(patch) => updateSearch(patch, true)}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ reset }) => (
              <DataTableError
                description={t('users.error-description')}
                onRetry={reset}
                title={t('users.error-title')}
              />
            )}
            pendingFallback={
              <UsersTableSkeleton columnVisibility={columnView.visibility} search={search} />
            }
            resetKey={JSON.stringify(query)}
          >
            <UsersTable
              columnVisibility={columnView.visibility}
              onEdit={editUser}
              onResetPassword={resetPassword}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {dialogsMounted && (
          <Suspense fallback={null}>
            <UserDialogs
              onClose={closeDialog}
              onCreated={setNewUserPassword}
              password={dialogs.password}
              user={dialogs.user}
            />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}
