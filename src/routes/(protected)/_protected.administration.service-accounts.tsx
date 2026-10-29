import { createFileRoute } from '@tanstack/react-router';
import { KeyRoundIcon } from 'lucide-react';
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
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { serviceAccountsListOptions } from '@/features/service-accounts/api/queries';
import {
  ServiceAccountsTable,
  ServiceAccountsTableSkeleton,
} from '@/features/service-accounts/components/service-accounts-table';
import { ServiceAccountsToolbar } from '@/features/service-accounts/components/service-accounts-toolbar';
import {
  type ServiceAccountsSearch,
  serviceAccountsSearchSchema,
  toServiceAccountsQuery,
} from '@/features/service-accounts/lib/search';
import { useCardLayout } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

// Their own chunk: the list paints without the dialogs, and the chunk is fetched right after.
const loadDialogs = () => import('@/features/service-accounts/components/service-account-dialogs');
const ServiceAccountDialogs = lazy(() =>
  loadDialogs().then((module) => ({ default: module.ServiceAccountDialogs })),
);

const CLOSED_DIALOGS = {
  add: undefined,
  delete: undefined,
} satisfies Partial<ServiceAccountsSearch>;

const noop = () => {};

export const Route = createFileRoute('/(protected)/_protected/administration/service-accounts')({
  validateSearch: serviceAccountsSearchSchema,
  loaderDeps: ({ search }) => ({ query: toServiceAccountsQuery(search) }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.serviceAccountsManage);
    queryClient.prefetchQuery(serviceAccountsListOptions(deps.query));
  },
  pendingComponent: ServiceAccountsPagePending,
  component: ServiceAccountsPage,
});

function ServiceAccountsPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ add: _add, delete: _delete, ...list }): ServiceAccountsSearch => list,
    structuralSharing: true,
  });
  const dialogs = Route.useSearch({
    select: ({ add, delete: token }) => ({
      adding: add === true,
      deleting: add ? undefined : token,
    }),
    structuralSharing: true,
  });
  const anyDialogOpen = dialogs.adding || dialogs.deleting !== undefined;
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<ServiceAccountsSearch>(CLOSED_DIALOGS);
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const addKey = useCallback(() => openDialog({ add: true }), [openDialog]);
  const deleteKey = useCallback((token: string) => openDialog({ delete: token }), [openDialog]);
  const [dialogsMounted, setDialogsMounted] = useState(anyDialogOpen);
  if (anyDialogOpen && !dialogsMounted) setDialogsMounted(true);
  useEffect(() => {
    void loadDialogs();
  }, []);

  return (
    <Workspace>
      <ServiceAccountsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <ServiceAccountsToolbar
            layout={cards ? 'cards' : 'table'}
            onAdd={addKey}
            onSortChange={updateSearch}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('service-accounts.error-description')}
                error={error}
                reset={reset}
                title={t('service-accounts.error-title')}
              />
            )}
            pendingFallback={<ServiceAccountsTableSkeleton cards={cards} search={search} />}
            resetKey={JSON.stringify(search)}
          >
            <ServiceAccountsTable
              cards={cards}
              onAdd={addKey}
              onDelete={deleteKey}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {dialogsMounted && (
          <Suspense fallback={null}>
            <ServiceAccountDialogs
              adding={dialogs.adding}
              deleting={dialogs.deleting}
              onClose={closeDialog}
            />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function ServiceAccountsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <KeyRoundIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('service-accounts.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('service-accounts.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function ServiceAccountsPagePending() {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <Workspace>
      <ServiceAccountsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          {cards && (
            <ServiceAccountsToolbar
              disabled
              layout="cards"
              onAdd={noop}
              onSortChange={noop}
              search={{}}
            />
          )}
          <ServiceAccountsTableSkeleton cards={cards} search={{}} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
