import { createFileRoute, useRouter } from '@tanstack/react-router';
import { CoinsIcon } from 'lucide-react';
import { lazy, type ReactNode, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/app-shell/list-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { buqCatalogOptions } from '@/features/buq-admin/api/queries';
import {
  BuqCatalogTable,
  BuqCatalogTableSkeleton,
} from '@/features/buq-admin/components/buq-catalog-table';
import { BuqCatalogToolbar } from '@/features/buq-admin/components/buq-catalog-toolbar';
import {
  type BuqCatalogSearch,
  buqCatalogSearchSchema,
  buqCatalogTableSearch,
  changeBuqCatalogSearch,
  DEFAULT_BUQ_CATALOG_TAB,
} from '@/features/buq-admin/lib/search';
import {
  BUQ_CATALOG_TABS,
  type BuqCatalogRowAction,
  type BuqCatalogTab,
} from '@/features/buq-admin/lib/types';
import type { BuqCatalogRecord } from '@/features/reference-data/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';
import { useDeleteRowHint } from '@/hooks/use-delete-row-hint';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { RIGHTS } from '@/lib/rights';

const CatalogFormDialog = lazy(() =>
  import('@/features/buq-admin/components/catalog-form-dialog').then((module) => ({
    default: module.CatalogFormDialog,
  })),
);
const DeleteCatalogDialog = lazy(() =>
  import('@/features/buq-admin/components/delete-catalog-dialog').then((module) => ({
    default: module.DeleteCatalogDialog,
  })),
);
const CLOSED_DIALOGS = { edit: undefined, delete: undefined } satisfies Partial<BuqCatalogSearch>;
const noop = () => {};

export const Route = createFileRoute('/(protected)/_protected/administration/manage-buq')({
  staticData: { rights: [RIGHTS.manageBuq] },
  validateSearch: buqCatalogSearchSchema,
  loaderDeps: ({ search }) => ({ tab: search.tab ?? DEFAULT_BUQ_CATALOG_TAB }),
  loader: async ({ route, context: { queryClient }, deps: { tab } }) => {
    await requireRouteRights(queryClient, route);
    queryClient.prefetchQuery(buqCatalogOptions(tab));
  },
  pendingComponent: ManageBuqPending,
  component: ManageBuqPage,
});

function ManageBuqPage() {
  const tab = Route.useSearch({ select: (search) => search.tab ?? DEFAULT_BUQ_CATALOG_TAB });
  const { updateSearch } = useSearchNavigation<BuqCatalogSearch>(CLOSED_DIALOGS);
  return (
    <ManageBuqWorkspace
      tab={tab}
      onTabChange={(next) =>
        updateSearch({
          tab: next === 'sources' ? next : undefined,
          ...CLOSED_DIALOGS,
        })
      }
    >
      <CatalogPanel key={tab} tab={tab} />
    </ManageBuqWorkspace>
  );
}

function CatalogPanel({ tab }: { tab: BuqCatalogTab }) {
  const { t } = useTranslation();
  const router = useRouter();
  const search = Route.useSearch({
    select: (value) => buqCatalogTableSearch(value, tab),
    structuralSharing: true,
  });
  const target = Route.useSearch({ select: (search) => search.edit });
  const deleting = Route.useSearch({ select: (search) => search.delete });
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<BuqCatalogSearch>(CLOSED_DIALOGS);
  const readSearch = useCallback(
    () => buqCatalogSearchSchema.parse(router.latestLocation.search),
    [router],
  );
  const onSearchChange = useMemo(
    () => changeBuqCatalogSearch(tab, updateSearch, readSearch),
    [tab, updateSearch, readSearch],
  );
  const close = () => {
    const active = readSearch();
    if (
      (active.tab ?? DEFAULT_BUQ_CATALOG_TAB) === tab &&
      active.edit === target &&
      active.delete === deleting
    )
      closeDialog();
  };
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const addButton = useRef<HTMLButtonElement>(null);
  const formOpener = useRef<HTMLButtonElement>(null);
  const deleteOpener = useRef<HTMLButtonElement>(null);
  const [deleteHint, setDeleteHint] = useDeleteRowHint<BuqCatalogRecord>(deleting);
  const [formMounted, setFormMounted] = useState(target !== undefined);
  const [deleteMounted, setDeleteMounted] = useState(deleting !== undefined);
  if (target !== undefined && !formMounted) setFormMounted(true);
  if (deleting !== undefined && !deleteMounted) setDeleteMounted(true);

  const add = useCallback(
    (opener: HTMLButtonElement) => {
      formOpener.current = opener;
      void openDialog({ edit: 'new' });
    },
    [openDialog],
  );
  const edit = useCallback<BuqCatalogRowAction>(
    (row, opener) => {
      formOpener.current = opener;
      void openDialog({ edit: row.id });
    },
    [openDialog],
  );
  const remove = useCallback<BuqCatalogRowAction>(
    (row, opener) => {
      deleteOpener.current = opener;
      setDeleteHint(row);
      void openDialog({ delete: row.id });
    },
    [openDialog, setDeleteHint],
  );

  return (
    <>
      <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
        <BuqCatalogToolbar
          addRef={addButton}
          cards={cards}
          onAdd={add}
          onSortChange={onSearchChange}
          search={search}
          tab={tab}
        />
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <ListError
              description={t('manage-buq.error-description')}
              error={error}
              reset={reset}
              title={t('manage-buq.error-title')}
            />
          )}
          pendingFallback={<BuqCatalogTableSkeleton cards={cards} search={search} tab={tab} />}
          resetKey={tab}
        >
          <BuqCatalogTable
            cards={cards}
            dialogOpen={target !== undefined || deleting !== undefined}
            onAdd={add}
            onDelete={remove}
            onEdit={edit}
            onSearchChange={onSearchChange}
            search={search}
            tab={tab}
          />
        </QueryBoundary>
      </div>
      {formMounted && (
        <Suspense fallback={null}>
          <CatalogFormDialog
            addButton={addButton}
            onClose={close}
            opener={formOpener}
            tab={tab}
            target={target}
          />
        </Suspense>
      )}
      {deleteMounted && (
        <Suspense fallback={null}>
          <DeleteCatalogDialog
            addButton={addButton}
            hint={deleteHint}
            onClose={close}
            opener={deleteOpener}
            tab={tab}
            target={deleting}
          />
        </Suspense>
      )}
    </>
  );
}

function ManageBuqPending() {
  const search = Route.useSearch();
  const tab = search.tab ?? DEFAULT_BUQ_CATALOG_TAB;
  const tableSearch = buqCatalogTableSearch(search, tab);
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <ManageBuqWorkspace tab={tab}>
      <div aria-busy className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
        <BuqCatalogToolbar
          disabled
          cards={cards}
          onAdd={noop}
          onSortChange={noop}
          search={tableSearch}
          tab={tab}
        />
        <BuqCatalogTableSkeleton cards={cards} search={tableSearch} tab={tab} />
      </div>
    </ManageBuqWorkspace>
  );
}

function ManageBuqWorkspace({
  tab,
  onTabChange,
  children,
}: {
  tab: BuqCatalogTab;
  onTabChange?: (tab: BuqCatalogTab) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Workspace width="narrow">
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <CoinsIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('nav.administration.manage-buq')}</WorkspaceTitle>
          <WorkspaceDescription>{t('manage-buq.description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>
        <Tabs spacing="page" value={tab} onValueChange={onTabChange}>
          <div className="@container">
            <TabsList aria-label={t('manage-buq.tabs-label')} size="lg" wrap>
              {BUQ_CATALOG_TABS.map((item) => (
                <TabsTrigger disabled={!onTabChange} key={item} value={item}>
                  {t(`manage-buq.tab.${item}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {BUQ_CATALOG_TABS.map((item) => (
            <TabsContent key={item} value={item}>
              {item === tab ? children : null}
            </TabsContent>
          ))}
        </Tabs>
      </WorkspaceContent>
    </Workspace>
  );
}
