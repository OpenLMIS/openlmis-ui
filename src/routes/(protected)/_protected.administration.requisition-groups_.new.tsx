import { createFileRoute, type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorFallback } from '@/components/error-fallback';
import { Button } from '@/components/ui/button';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
  prefetchRequisitionGroupLookups,
  RequisitionGroupEditor,
  RequisitionGroupEditorSkeleton,
} from '@/features/requisition-groups/components/requisition-group-editor';
import {
  type RequisitionGroupEditorSearch,
  requisitionGroupEditorSearchSchema,
} from '@/features/requisition-groups/lib/members';
import type { SearchChange } from '@/lib/table-search';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/requisition-groups_/new',
)({
  validateSearch: requisitionGroupEditorSearchSchema,
  staticData: { crumbKey: 'requisition-groups.form.add-title' },
  loader: async ({ context: { queryClient } }) => {
    await requireRight(queryClient, RIGHTS.requisitionGroupsManage);
    prefetchRequisitionGroupLookups(queryClient);
  },
  pendingComponent: AddGroupPending,
  errorComponent: AddGroupError,
  component: AddGroupPage,
});
function AddGroupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const [listSearch] = useState(
    () => router.state.location.state.requisitionGroupsListSearch ?? {},
  );
  const backToList = useCallback(
    () => navigate({ to: '/administration/requisition-groups', search: listSearch }),
    [navigate, listSearch],
  );
  const onSearchChange = useCallback<SearchChange<RequisitionGroupEditorSearch>>(
    (update, replace = false, options) => {
      void navigate({
        search: (previous) => ({
          ...previous,
          ...(typeof update === 'function' ? update(previous) : update),
        }),
        state: (previous) => previous,
        replace,
        resetScroll: options?.resetScroll ?? false,
      });
    },
    [navigate],
  );
  return (
    <RequisitionGroupEditor
      title={t('requisition-groups.form.add-title')}
      description={t('requisition-groups.form.add-description')}
      search={search}
      onSearchChange={onSearchChange}
      onCancel={backToList}
      onSaved={(saved) => {
        toast.success(t('requisition-groups.form.saved-title'), {
          description: t('requisition-groups.form.saved', { name: saved.name }),
        });
        void backToList();
      }}
    />
  );
}
function AddGroupPending() {
  const { t } = useTranslation();
  return (
    <RequisitionGroupEditorSkeleton
      title={t('requisition-groups.form.add-title')}
      description={t('requisition-groups.form.add-description')}
    />
  );
}
function AddGroupError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const listSearch = router.state.location.state.requisitionGroupsListSearch ?? {};
  const back = (
    <Button
      nativeButton={false}
      render={<Link to="/administration/requisition-groups" search={listSearch} />}
      variant="outline"
    >
      {t('requisition-groups.form.back')}
    </Button>
  );
  return (
    <ErrorFallback
      {...props}
      back={back}
      title={t('requisition-groups.form.load-group-error-title')}
      description={t('requisition-groups.form.load-group-error-description')}
    />
  );
}
