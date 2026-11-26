import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { BellIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { notificationsPageOptions } from '@/features/system-notifications/api/queries';
import {
  NotificationsTable,
  NotificationsTableSkeleton,
} from '@/features/system-notifications/components/notifications-table';
import { NotificationsToolbar } from '@/features/system-notifications/components/notifications-toolbar';
import {
  type NotificationsSearch,
  notificationsSearchSchema,
  SYSTEM_NOTIFICATION_HIDEABLE_COLUMNS,
  toNotificationsQuery,
} from '@/features/system-notifications/lib/search';
import { allUsersOptions } from '@/features/users/api/queries';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { RIGHTS } from '@/lib/rights';
import { fullName } from '@/lib/text';

const CLOSED_DIALOGS = { notification: undefined } satisfies Partial<NotificationsSearch>;
const useNotificationsView = () =>
  useCardView(SYSTEM_NOTIFICATION_HIDEABLE_COLUMNS, 'system-notifications.column-visibility');
const noop = () => {};

export const Route = createFileRoute('/(protected)/_protected/administration/system-notifications')(
  {
    staticData: { rights: [RIGHTS.systemNotificationsManage] },
    validateSearch: notificationsSearchSchema,
    loaderDeps: ({ search }) => ({ query: toNotificationsQuery(search) }),
    loader: async ({ context: { queryClient }, route, deps }) => {
      const { rights } = await requireRouteRights(queryClient, route);
      queryClient.prefetchQuery(notificationsPageOptions(deps.query));
      queryClient.prefetchQuery(deploymentTimeZoneOptions());
      return { canFilterAuthors: rights.has(RIGHTS.usersManage) };
    },
    pendingComponent: NotificationsPagePending,
    component: SystemNotificationsPage,
  },
);

function SystemNotificationsPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ notification: _notification, ...list }): NotificationsSearch => list,
    structuralSharing: true,
  });
  const { canFilterAuthors } = Route.useLoaderData();
  const query = Route.useLoaderDeps({ select: (deps) => deps.query });
  const { measure, cards, columnView, layout } = useNotificationsView();
  const { updateSearch, openDialog } = useSearchNavigation<NotificationsSearch>(CLOSED_DIALOGS);
  const edit = useCallback((id: string) => openDialog({ notification: id }), [openDialog]);
  const [openedAuthors, setOpenedAuthors] = useState(false);
  const authors = useQuery({
    ...allUsersOptions(),
    enabled: canFilterAuthors && (openedAuthors || Boolean(search.authorId)),
  });
  const options = useMemo(
    () =>
      (authors.data ?? []).map((user) => ({
        value: user.id,
        label: fullName(user) || user.username,
        description: user.username,
      })),
    [authors.data],
  );
  const authorFilter = canFilterAuthors
    ? {
        options:
          search.authorId &&
          authors.isSuccess &&
          !options.some(({ value }) => value === search.authorId)
            ? [
                ...options,
                { value: search.authorId, label: t('system-notifications.admin.unknown-author') },
              ]
            : options,
        emptyMessage: authors.isError
          ? t('system-notifications.admin.authors-error')
          : authors.isPending
            ? t('system-notifications.admin.authors-loading')
            : t('data-table.no-matches'),
        status: authors.data
          ? t('system-notifications.admin.author-status', { count: options.length })
          : undefined,
        onOpenChange: (open: boolean) => {
          if (open) setOpenedAuthors(true);
        },
      }
    : undefined;

  return (
    <Workspace>
      <NotificationsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <NotificationsToolbar
            authorFilter={authorFilter}
            columnView={columnView}
            layout={layout}
            onAdd={() => openDialog({ notification: 'new' })}
            onFilterChange={(patch) => updateSearch(patch, true)}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('system-notifications.admin.error-description')}
                error={error}
                reset={reset}
                title={t('system-notifications.admin.error-title')}
              />
            )}
            pendingFallback={
              <NotificationsTableSkeleton
                cards={cards}
                columnVisibility={columnView.visibility}
                search={search}
              />
            }
            resetKey={JSON.stringify(query)}
          >
            <NotificationsTable
              cards={cards}
              columnVisibility={columnView.visibility}
              onEdit={edit}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function NotificationsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <BellIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('nav.administration.system-notifications')}</WorkspaceTitle>
        <WorkspaceDescription>
          {t('system-notifications.admin.page-description')}
        </WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function NotificationsPagePending() {
  const { measure, cards, columnView, layout } = useNotificationsView();
  return (
    <Workspace>
      <NotificationsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <NotificationsToolbar
            columnView={columnView}
            disabled
            layout={layout}
            onAdd={noop}
            onFilterChange={noop}
            search={{}}
          />
          <NotificationsTableSkeleton
            cards={cards}
            columnVisibility={columnView.visibility}
            search={{}}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
