import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
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
  '/(protected)/_protected/administration/requisition-groups_/$id',
)({
  validateSearch: requisitionGroupEditorSearchSchema,
  staticData: { crumbKey: 'requisition-groups.view-title' },
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    await requireRight(queryClient, RIGHTS.requisitionGroupsManage);
    return loadRequisitionGroup(queryClient, params.id, cause);
  },
  pendingComponent: ViewGroupPending,
  errorComponent: RequisitionGroupRouteError,
  component: ViewGroupPage,
});
function ViewGroupPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { saved, readAt } = Route.useLoaderData();
  const { backToList, onSearchChange } = useRequisitionGroupNavigation(Route.fullPath);
  return (
    <RequisitionGroupEditor
      key={`${id}:${readAt}`}
      saved={saved}
      title={saved.name}
      description={t('requisition-groups.form.view-description')}
      search={search}
      onSearchChange={onSearchChange}
      onCancel={backToList}
      readOnly
    />
  );
}
function ViewGroupPending() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  return (
    <RequisitionGroupEditorSkeleton
      search={search}
      description={t('requisition-groups.form.view-description')}
      readOnly
    />
  );
}
