import { createFileRoute } from '@tanstack/react-router';
import { UsersIcon } from 'lucide-react';
import { useCallback } from 'react';
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
import { usersListOptions } from '@/features/users/api/queries';
import { UserFormDialog } from '@/features/users/components/user-form-dialog';
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

export const Route = createFileRoute('/(protected)/_protected/administration/users')({
  validateSearch: usersSearchSchema,
  loaderDeps: ({ search }) => toUsersQuery(search),
  loader: ({ context: { queryClient }, deps }) => {
    queryClient.prefetchQuery(usersListOptions(deps));
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
  const query = Route.useLoaderDeps();

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
  // Opening adds a history entry, so Back closes the dialog; closing replaces it.
  const openUserDialog = useCallback(
    (user: 'new' | string) => updateSearch({ user }),
    [updateSearch],
  );
  const closeUserDialog = useCallback(
    () => updateSearch({ user: undefined }, true),
    [updateSearch],
  );

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
        <UserFormDialog onClose={closeUserDialog} target={dialogTarget} />
      </WorkspaceContent>
    </Workspace>
  );
}
