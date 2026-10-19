import { createFileRoute } from '@tanstack/react-router';
import { FolderXIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListError } from '@/components/list-error';
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
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { rejectionReasonCategoriesOptions } from '@/features/reference-data/api/queries';
import {
  CategoriesTable,
  CategoriesTableSkeleton,
} from '@/features/rejection-reasons/components/categories-table';
import { CategoriesToolbar } from '@/features/rejection-reasons/components/categories-toolbar';
import {
  CATEGORY_HIDEABLE_COLUMNS,
  type CategoriesListSearch,
  type CategoriesSearch,
  categoriesSearchSchema,
} from '@/features/rejection-reasons/lib/search';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const loadDialog = () => import('@/features/rejection-reasons/components/category-form-dialog');
const CategoryFormDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.CategoryFormDialog })),
);
const CLOSED_DIALOGS = { category: undefined } satisfies Partial<CategoriesSearch>;
export const Route = createFileRoute(
  '/(protected)/_protected/administration/rejection-reason-categories',
)({
  validateSearch: categoriesSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    await requireRight(queryClient, RIGHTS.usersManage);
    queryClient.prefetchQuery({ ...rejectionReasonCategoriesOptions(), staleTime: 30 * 1000 });
  },
  pendingComponent: CategoriesPagePending,
  component: CategoriesPage,
});

function CategoriesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ category: _category, ...list }): CategoriesListSearch => list,
    structuralSharing: true,
  });
  const target = Route.useSearch({ select: (search) => search.category });
  const { measure, cards, columnView, layout } = useCardView(
    CATEGORY_HIDEABLE_COLUMNS,
    'rejection-reason-categories.column-visibility',
  );
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<CategoriesSearch>(CLOSED_DIALOGS);
  const addCategory = useCallback(() => openDialog({ category: 'new' }), [openDialog]);
  const [dialogMounted, setDialogMounted] = useState(target !== undefined);
  if (target !== undefined && !dialogMounted) setDialogMounted(true);
  useEffect(() => {
    void loadDialog();
  }, []);

  return (
    <Workspace>
      <CategoriesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <CategoriesToolbar
            search={search}
            onSearchChange={updateSearch}
            columnView={columnView}
            layout={layout}
            onAdd={addCategory}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                error={error}
                reset={reset}
                title={t('rejection-reason-categories.error-title')}
                description={t('rejection-reason-categories.error-description')}
              />
            )}
            pendingFallback={
              <CategoriesTableSkeleton
                cards={cards}
                search={search}
                columnVisibility={columnView.visibility}
              />
            }
            resetKey="rejection-reason-categories"
          >
            <CategoriesTable
              cards={cards}
              search={search}
              onSearchChange={updateSearch}
              columnVisibility={columnView.visibility}
              onAdd={addCategory}
            />
          </QueryBoundary>
        </div>
        {dialogMounted && (
          <Suspense fallback={null}>
            <CategoryFormDialog target={target} onClose={closeDialog} />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function CategoriesHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <FolderXIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('nav.administration.rejection-reason-category')}</WorkspaceTitle>
        <WorkspaceDescription>
          {t('rejection-reason-categories.page-description')}
        </WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function CategoriesPagePending() {
  const { measure, cards, columnView } = useCardView(
    CATEGORY_HIDEABLE_COLUMNS,
    'rejection-reason-categories.column-visibility',
  );
  return (
    <Workspace>
      <CategoriesHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <CategoriesTableSkeleton
            cards={cards}
            columnVisibility={columnView.visibility}
            search={{}}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
