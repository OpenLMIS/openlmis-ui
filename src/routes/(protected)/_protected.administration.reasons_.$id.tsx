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
import { reasonDetailOptions, validReasonsOptions } from '@/features/reasons/api/queries';
import {
  prefetchReasonEditorLookups,
  ReasonEditor,
  ReasonEditorSkeleton,
} from '@/features/reasons/components/reason-editor';
import { isNotFound } from '@/lib/http';

export const Route = createFileRoute('/(protected)/_protected/administration/reasons_/$id')({
  staticData: { crumbKey: 'reasons.form.edit-title' },
  // A preloaded page would open on the copy read at hover, and the save sends the whole reason back.
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    const detail = reasonDetailOptions(params.id);
    const pairs = validReasonsOptions(params.id);
    const stay = cause === 'stay';
    await Promise.all([
      requireRight(queryClient, RIGHTS.stockCardLineItemReasonsManage),
      stay
        ? queryClient.ensureQueryData(detail)
        : queryClient.fetchQuery({ ...detail, staleTime: 0 }),
      stay
        ? queryClient.ensureQueryData(pairs)
        : queryClient.fetchQuery({ ...pairs, staleTime: 0 }),
    ]);
    prefetchReasonEditorLookups(queryClient);
  },
  pendingComponent: EditReasonPending,
  errorComponent: EditReasonError,
  component: EditReasonPage,
});

function EditReasonPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const { id } = Route.useParams();
  const { data: reason } = useSuspenseQuery(reasonDetailOptions(id));
  const { data: pairs } = useSuspenseQuery(validReasonsOptions(id));
  const [saved] = useState(() => ({ reason, pairs }));
  const [listSearch] = useState(() => router.state.location.state.reasonsListSearch ?? {});
  const backToList = useCallback(
    () => navigate({ to: '/administration/reasons', search: listSearch }),
    [navigate, listSearch],
  );

  return (
    <ReasonEditor
      description={t('reasons.form.edit-description')}
      discardDescription={t('reasons.form.edit-discard-description', { name: saved.reason.name })}
      onCancel={backToList}
      onSaved={(result) => {
        toast.success(t('reasons.form.saved-title'), {
          description: t('reasons.form.saved', { name: result.name }),
        });
        void backToList();
      }}
      saved={saved}
      submitLabel={t('reasons.form.save')}
      title={t('reasons.form.edit-heading', { name: saved.reason.name })}
    />
  );
}

function EditReasonPending() {
  const { t } = useTranslation();
  return (
    <ReasonEditorSkeleton
      editing
      submitLabel={t('reasons.form.save')}
      description={t('reasons.form.edit-description')}
      title={t('reasons.form.edit-title')}
    />
  );
}

function EditReasonError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  if (!isNotFound(props.error)) {
    return (
      <ErrorFallback
        {...props}
        description={t('reasons.form.load-reason-error-description')}
        title={t('reasons.form.load-reason-error-title')}
      />
    );
  }

  return (
    <Workspace>
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{t('reasons.form.not-found-title')}</EmptyTitle>
            <EmptyDescription>{t('reasons.form.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link to="/administration/reasons" />}
              variant="outline"
            >
              {t('reasons.form.back')}
            </Button>
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
