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
import { rejectionReasonCategoriesOptions } from '@/features/reference-data/api/queries';
import { rejectionReasonDetailOptions } from '@/features/rejection-reasons/api/queries';
import {
  RejectionReasonEditor,
  RejectionReasonEditorSkeleton,
} from '@/features/rejection-reasons/components/rejection-reason-editor';
import { rejectionReasonsListSearchSchema } from '@/features/rejection-reasons/lib/search';
import { isNotFound } from '@/lib/http';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/rejection-reasons_/$id',
)({
  validateSearch: rejectionReasonsListSearchSchema,
  staticData: {
    crumbKey: 'rejection-reasons.form.edit-title',
    crumbParentSearch: (search) => rejectionReasonsListSearchSchema.parse(search),
  },
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    const detail = rejectionReasonDetailOptions(params.id);
    await Promise.all([
      requireRight(queryClient, RIGHTS.usersManage),
      cause === 'stay'
        ? queryClient.ensureQueryData(detail)
        : queryClient.fetchQuery({ ...detail, staleTime: 0 }),
    ]);
    queryClient.prefetchQuery(rejectionReasonCategoriesOptions());
  },
  pendingComponent: RejectionReasonEditorSkeleton,
  errorComponent: EditRejectionReasonError,
  component: EditRejectionReasonPage,
});

function EditRejectionReasonPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const { id } = Route.useParams();
  const urlSearch = Route.useSearch();
  const { data: reason } = useSuspenseQuery(rejectionReasonDetailOptions(id));
  const [saved] = useState(() => reason);
  const [listSearch] = useState(() =>
    rejectionReasonsListSearchSchema.parse(
      router.state.location.state.rejectionReasonsListSearch ?? urlSearch,
    ),
  );
  const backToList = useCallback(
    () => navigate({ to: '/administration/rejection-reasons', search: listSearch }),
    [navigate, listSearch],
  );

  return (
    <RejectionReasonEditor
      saved={saved}
      onCancel={backToList}
      onSaved={(result) => {
        toast.success(t('rejection-reasons.form.saved-title'), {
          description: t('rejection-reasons.form.saved', { name: result.name }),
        });
        void backToList();
      }}
    />
  );
}

function EditRejectionReasonError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  const search = rejectionReasonsListSearchSchema.parse(useRouter().state.location.search);
  const back = (
    <Button
      nativeButton={false}
      render={<Link to="/administration/rejection-reasons" search={search} />}
      variant="outline"
    >
      {t('rejection-reasons.form.back')}
    </Button>
  );
  if (!isNotFound(props.error))
    return (
      <ErrorFallback
        {...props}
        back={back}
        title={t('rejection-reasons.form.load-error-title')}
        description={t('rejection-reasons.form.load-error-description')}
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
            <EmptyTitle>{t('rejection-reasons.form.not-found-title')}</EmptyTitle>
            <EmptyDescription>{t('rejection-reasons.form.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{back}</EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
