import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorFallback } from '@/components/error-fallback';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Workspace, WorkspaceContent } from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { rejectionReasonCategoryDetailOptions } from '@/features/rejection-reasons/api/queries';
import {
  CategoryEditor,
  CategoryEditorSkeleton,
} from '@/features/rejection-reasons/components/category-editor';
import { categoriesListSearchSchema } from '@/features/rejection-reasons/lib/search';
import { isNotFound } from '@/lib/http';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/rejection-reason-categories_/$id',
)({
  validateSearch: categoriesListSearchSchema,
  staticData: {
    crumbKey: 'rejection-reason-categories.form.edit-title',
    crumbParentSearch: (search) => categoriesListSearchSchema.parse(search),
  },
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    const detail = rejectionReasonCategoryDetailOptions(params.id);
    await Promise.all([
      requireRight(queryClient, RIGHTS.usersManage),
      cause === 'stay'
        ? queryClient.ensureQueryData(detail)
        : queryClient.fetchQuery({ ...detail, staleTime: 0 }),
    ]);
  },
  pendingComponent: CategoryEditorSkeleton,
  errorComponent: EditCategoryError,
  component: EditCategoryPage,
});

function EditCategoryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const { id } = Route.useParams();
  const urlSearch = Route.useSearch();
  const { data: category } = useSuspenseQuery(rejectionReasonCategoryDetailOptions(id));
  const [saved] = useState(() => category);
  const [listSearch] = useState(() =>
    categoriesListSearchSchema.parse(
      router.state.location.state.rejectionReasonCategoriesListSearch ?? urlSearch,
    ),
  );
  const backToList = useCallback(
    () => navigate({ to: '/administration/rejection-reason-categories', search: listSearch }),
    [navigate, listSearch],
  );

  return (
    <CategoryEditor
      saved={saved}
      onCancel={backToList}
      onSaved={(result) => {
        toast.success(t('rejection-reason-categories.form.saved-title'), {
          description: t('rejection-reason-categories.form.saved', { name: result.name }),
        });
        void backToList();
      }}
    />
  );
}

function EditCategoryError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  const search = categoriesListSearchSchema.parse(useRouter().state.location.search);
  const back = (
    <Button
      nativeButton={false}
      render={<Link to="/administration/rejection-reason-categories" search={search} />}
      variant="outline"
    >
      {t('rejection-reason-categories.form.back')}
    </Button>
  );
  if (!isNotFound(props.error))
    return (
      <ErrorFallback
        {...props}
        back={back}
        title={t('rejection-reason-categories.form.load-error-title')}
        description={t('rejection-reason-categories.form.load-error-description')}
      />
    );
  return (
    <Workspace>
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{t('rejection-reason-categories.form.not-found-title')}</EmptyTitle>
            <EmptyDescription>
              {t('rejection-reason-categories.form.not-found-description')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{back}</EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
