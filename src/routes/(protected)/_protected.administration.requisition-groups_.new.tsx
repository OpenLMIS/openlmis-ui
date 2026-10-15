import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
  prefetchRequisitionGroupLookups,
  RequisitionGroupEditor,
  RequisitionGroupEditorSkeleton,
} from '@/features/requisition-groups/components/requisition-group-editor';
import { requisitionGroupEditorSearchSchema } from '@/features/requisition-groups/lib/members';
import {
  AddRequisitionGroupRouteError,
  useRequisitionGroupNavigation,
} from '@/routes/(protected)/-requisition-group-route';

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
  errorComponent: AddRequisitionGroupRouteError,
  component: AddGroupPage,
});
function AddGroupPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { backToList, onSearchChange } = useRequisitionGroupNavigation(Route.fullPath);
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
  const search = Route.useSearch();
  return (
    <RequisitionGroupEditorSkeleton
      search={search}
      title={t('requisition-groups.form.add-title')}
      description={t('requisition-groups.form.add-description')}
    />
  );
}
