import { createFileRoute, useRouter } from '@tanstack/react-router';
import { UsersIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableError } from '@/components/data-table/data-table';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
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
import { minimalFacilitiesOptions } from '@/lib/reference-data/facilities';
import type { SearchUpdate } from '@/lib/table-search';

// Its own chunk: the list paints without the form, and the chunk is fetched right after.
const loadUserFormDialog = () => import('@/features/users/components/user-form-dialog');
const UserFormDialog = lazy(() =>
  loadUserFormDialog().then((module) => ({ default: module.UserFormDialog })),
);

export const Route = createFileRoute('/(protected)/_protected/administration/users')({
  validateSearch: usersSearchSchema,
  loaderDeps: ({ search }) => ({ query: toUsersQuery(search), user: search.user }),
  loader: ({ context: { queryClient }, deps }) => {
    queryClient.prefetchQuery(usersListOptions(deps.query));
    // The dialog's data starts with the navigation, not once the dialog has rendered.
    if (deps.user) queryClient.prefetchQuery(minimalFacilitiesOptions());
    if (deps.user && deps.user !== 'new') queryClient.prefetchQuery(userDetailsOptions(deps.user));
  },
  component: UsersPage,
});

const columnChoicesSchema = z.record(z.string(), z.boolean());

function UsersPage() {
  const { t } = useTranslation();
  // Without the dialog's param, and shared structurally, so opening a dialog leaves the table alone.
  const search = Route.useSearch({
    select: ({ user: _dialog, ...list }): UsersSearch => list,
    structuralSharing: true,
  });
  const dialogTarget = Route.useSearch({ select: (current) => current.user });
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
  // Set when this page opened the dialog, so closing steps Back instead of adding a second list entry.
  const openedHere = useRef(false);
  const openUserDialog = useCallback(
    (user: NonNullable<UsersSearch['user']>) => {
      openedHere.current = true;
      updateSearch({ user });
    },
    [updateSearch],
  );
  const closeUserDialog = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      router.history.back();
    } else {
      updateSearch({ user: undefined }, true);
    }
  }, [router, updateSearch]);
  // Mounted from the first open on, so it can still animate closed.
  const [dialogMounted, setDialogMounted] = useState(dialogTarget !== undefined);
  if (dialogTarget !== undefined && !dialogMounted) setDialogMounted(true);
  useEffect(() => {
    void loadUserFormDialog();
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
            onAdd={() => openUserDialog('new')}
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
              onEdit={openUserDialog}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {dialogMounted && (
          <Suspense fallback={null}>
            <UserFormDialog onClose={closeUserDialog} target={dialogTarget} />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}
