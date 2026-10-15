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
  loadRequisitionGroup,
  RequisitionGroupRouteError,
  useRequisitionGroupNavigation,
} from '@/routes/(protected)/-requisition-group-route';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/requisition-groups_/$id_/edit',
)({
  validateSearch: requisitionGroupEditorSearchSchema,
  staticData: { crumbKey: 'requisition-groups.form.edit-title' },
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    await requireRight(queryClient, RIGHTS.requisitionGroupsManage);
    prefetchRequisitionGroupLookups(queryClient);
    return loadRequisitionGroup(queryClient, params.id, cause);
  },
  pendingComponent: EditGroupPending,
  errorComponent: RequisitionGroupRouteError,
  component: EditGroupPage,
});
function EditGroupPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { saved, readAt } = Route.useLoaderData();
  const { backToList, onSearchChange } = useRequisitionGroupNavigation(Route.fullPath);
  return (
    <RequisitionGroupEditor
      key={`${id}:${readAt}`}
      saved={saved}
      title={t('requisition-groups.form.edit-heading', { name: saved.name })}
      description={t('requisition-groups.form.edit-description')}
      search={search}
      onSearchChange={onSearchChange}
      onCancel={backToList}
      onSaved={(result) => {
        toast.success(t('requisition-groups.form.saved-title'), {
          description: t('requisition-groups.form.saved', { name: result.name }),
        });
        void backToList();
      }}
    />
  );
}
function EditGroupPending() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  return (
    <RequisitionGroupEditorSkeleton
      search={search}
      description={t('requisition-groups.form.edit-description')}
    />
  );
}
