import { createFileRoute } from '@tanstack/react-router';
import { FolderXIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
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
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';

const loadDialog = () => import('@/features/rejection-reasons/components/category-form-dialog');
const CategoryFormDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.CategoryFormDialog })),
);
const CLOSED_DIALOGS = { category: undefined } satisfies Partial<CategoriesSearch>;
const columnChoicesSchema = z.record(z.string(), z.boolean());

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
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    CATEGORY_HIDEABLE_COLUMNS,
    useStoredState('rejection-reason-categories.column-visibility', columnChoicesSchema, {}),
    contentWidth,
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
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measureContent}>
          <CategoriesToolbar
            search={search}
            onSearchChange={updateSearch}
            columnView={columnView}
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
              <CategoriesTableSkeleton search={search} columnVisibility={columnView.visibility} />
            }
            resetKey="rejection-reason-categories"
          >
            <CategoriesTable
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
  return (
    <Workspace>
      <CategoriesHeader />
      <WorkspaceContent>
        <CategoriesTableSkeleton search={{}} columnVisibility={{}} />
      </WorkspaceContent>
    </Workspace>
  );
}
