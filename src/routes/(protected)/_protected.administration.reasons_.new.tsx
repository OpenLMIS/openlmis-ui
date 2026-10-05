import { createFileRoute, type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorFallback } from '@/components/error-fallback';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
  prefetchReasonEditorLookups,
  ReasonEditor,
  ReasonEditorSkeleton,
} from '@/features/reasons/components/reason-editor';

export const Route = createFileRoute('/(protected)/_protected/administration/reasons_/new')({
  staticData: { crumbKey: 'reasons.form.create-title' },
  loader: async ({ context: { queryClient } }) => {
    await requireRight(queryClient, RIGHTS.stockCardLineItemReasonsManage);
    prefetchReasonEditorLookups(queryClient);
  },
  pendingComponent: AddReasonPending,
  errorComponent: AddReasonError,
  component: AddReasonPage,
});

function AddReasonPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const [listSearch] = useState(() => router.state.location.state.reasonsListSearch ?? {});
  const backToList = useCallback(
    () => navigate({ to: '/administration/reasons', search: listSearch }),
    [navigate, listSearch],
  );

  return (
    <ReasonEditor
      description={t('reasons.form.create-description')}
      discardDescription={t('reasons.form.discard-description')}
      onCancel={backToList}
      onSaved={(saved) => {
        toast.success(t('reasons.form.created-title'), {
          description: t('reasons.form.created', { name: saved.name }),
        });
        void backToList();
      }}
      submitLabel={t('reasons.form.create')}
      title={t('reasons.form.create-title')}
    />
  );
}

function AddReasonPending() {
  const { t } = useTranslation();
  return (
    <ReasonEditorSkeleton
      description={t('reasons.form.create-description')}
      title={t('reasons.form.create-title')}
    />
  );
}

function AddReasonError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ErrorFallback
      {...props}
      description={t('reasons.error-description')}
      title={t('reasons.form.load-error-title')}
    />
  );
}
