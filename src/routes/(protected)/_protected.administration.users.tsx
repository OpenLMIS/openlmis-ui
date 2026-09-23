import { createFileRoute } from '@tanstack/react-router';
import { PlusIcon, UsersIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableError } from '@/components/data-table/data-table';
import { useColumnVisibility } from '@/components/data-table/responsive-columns';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
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
import { usersListOptions } from '@/features/users/api/queries';
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
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const columnView = useColumnVisibility(
    USER_HIDEABLE_COLUMNS,
    useStoredState('users.column-visibility', columnChoicesSchema, {}),
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
        <WorkspaceActions>
          {/* TODO: Open the create user screen once it exists. */}
          <Button size="lg" width="mobile-full">
            <PlusIcon data-icon="inline-start" />
            {t('users.add')}
          </Button>
        </WorkspaceActions>
      </WorkspaceHeader>
      <WorkspaceContent>
        <UsersToolbar
          columnView={columnView}
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
            onSearchChange={updateSearch}
            search={search}
          />
        </QueryBoundary>
      </WorkspaceContent>
    </Workspace>
  );
}
