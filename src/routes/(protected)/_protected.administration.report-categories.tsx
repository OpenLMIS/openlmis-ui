import { createFileRoute } from '@tanstack/react-router';
import { TagsIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useRef, useState } from 'react';
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
import { reportCategoriesPageOptions } from '@/features/report-categories/api/queries';
import {
  ReportCategoriesTable,
  ReportCategoriesTableSkeleton,
} from '@/features/report-categories/components/report-categories-table';
import { ReportCategoriesToolbar } from '@/features/report-categories/components/report-categories-toolbar';
import {
  type ReportCategoriesSearch,
  reportCategoriesSearchSchema,
  toReportCategoriesQuery,
} from '@/features/report-categories/lib/search';
import type { ReportCategory } from '@/features/report-categories/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { RIGHTS } from '@/lib/rights';

const CategoryFormDialog = lazy(() =>
  import('@/features/report-categories/components/category-form-dialog').then((module) => ({
    default: module.CategoryFormDialog,
  })),
);
const DeleteCategoryDialog = lazy(() =>
  import('@/features/report-categories/components/delete-category-dialog').then((module) => ({
    default: module.DeleteCategoryDialog,
  })),
);

const CLOSED_DIALOGS = {
  category: undefined,
  delete: undefined,
} satisfies Partial<ReportCategoriesSearch>;

const noop = () => {};

export const Route = createFileRoute('/(protected)/_protected/administration/report-categories')({
  staticData: { rights: [RIGHTS.reportCategoriesManage] },
  validateSearch: reportCategoriesSearchSchema,
  loaderDeps: ({ search }) => ({ query: toReportCategoriesQuery(search) }),
  loader: async ({ route, context: { queryClient }, deps }) => {
    await requireRouteRights(queryClient, route);
    queryClient.prefetchQuery(reportCategoriesPageOptions(deps.query));
  },
  pendingComponent: ReportCategoriesPagePending,
  component: ReportCategoriesPage,
});

function ReportCategoriesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ category: _category, delete: _delete, ...list }): ReportCategoriesSearch => list,
    structuralSharing: true,
  });
  const target = Route.useSearch({ select: (search) => search.category });
  const deleting = Route.useSearch({
    select: (search) => (search.category ? undefined : search.delete),
  });
  const dialogOpen = target !== undefined || deleting !== undefined;
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<ReportCategoriesSearch>(CLOSED_DIALOGS);
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const addButton = useRef<HTMLButtonElement>(null);
  const formOpener = useRef<HTMLButtonElement | null>(null);
  const deleteOpener = useRef<HTMLButtonElement | null>(null);
  const [deleteHint, setDeleteHint] = useState<ReportCategory>();
  const [formMounted, setFormMounted] = useState(target !== undefined);
  const [deleteMounted, setDeleteMounted] = useState(deleting !== undefined);
  if (target !== undefined && !formMounted) setFormMounted(true);
  if (deleting !== undefined && !deleteMounted) setDeleteMounted(true);
  const add = useCallback(
    (opener: HTMLButtonElement) => {
      formOpener.current = opener;
      void openDialog({ category: 'new' });
    },
    [openDialog],
  );
  const edit = useCallback(
    (row: ReportCategory, opener: HTMLButtonElement) => {
      formOpener.current = opener;
      void openDialog({ category: row.id });
    },
    [openDialog],
  );
  const remove = useCallback(
    (row: ReportCategory, opener: HTMLButtonElement) => {
      deleteOpener.current = opener;
      setDeleteHint(row);
      void openDialog({ delete: row.id });
    },
    [openDialog],
  );

  return (
    <Workspace width="narrow">
      <ReportCategoriesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <ReportCategoriesToolbar
            addRef={addButton}
            layout={cards ? 'cards' : 'table'}
            onAdd={add}
            onSortChange={updateSearch}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('report-categories.error-description')}
                error={error}
                reset={reset}
                title={t('report-categories.error-title')}
              />
            )}
            pendingFallback={<ReportCategoriesTableSkeleton cards={cards} search={search} />}
            resetKey={JSON.stringify(search)}
          >
            <ReportCategoriesTable
              cards={cards}
              onAdd={add}
              dialogOpen={dialogOpen}
              onDelete={remove}
              onEdit={edit}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {formMounted && (
          <Suspense fallback={null}>
            <CategoryFormDialog
              addButton={addButton}
              onClose={closeDialog}
              opener={formOpener}
              target={target}
            />
          </Suspense>
        )}
        {deleteMounted && (
          <Suspense fallback={null}>
            <DeleteCategoryDialog
              addButton={addButton}
              hint={deleteHint}
              onClose={closeDialog}
              onCloseComplete={() => setDeleteHint(undefined)}
              opener={deleteOpener}
              target={deleting}
            />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function ReportCategoriesHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <TagsIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('nav.administration.report-categories')}</WorkspaceTitle>
        <WorkspaceDescription>{t('report-categories.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function ReportCategoriesPagePending() {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <Workspace width="narrow">
      <ReportCategoriesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <ReportCategoriesToolbar
            disabled
            layout={cards ? 'cards' : 'table'}
            onAdd={noop}
            onSortChange={noop}
            search={{}}
          />
          <ReportCategoriesTableSkeleton cards={cards} search={{}} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
