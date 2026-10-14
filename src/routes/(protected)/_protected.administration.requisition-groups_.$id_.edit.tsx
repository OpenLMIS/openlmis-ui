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
import { requisitionGroupOptions } from '@/features/requisition-groups/api/queries';
import {
  prefetchRequisitionGroupLookups,
  RequisitionGroupEditor,
  RequisitionGroupEditorSkeleton,
} from '@/features/requisition-groups/components/requisition-group-editor';
import {
  type RequisitionGroupEditorSearch,
  requisitionGroupEditorSearchSchema,
} from '@/features/requisition-groups/lib/members';
import { isNotFound } from '@/lib/http';
import type { SearchChange } from '@/lib/table-search';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/requisition-groups_/$id_/edit',
)({
  validateSearch: requisitionGroupEditorSearchSchema,
  staticData: { crumbKey: 'requisition-groups.form.edit-title' },
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    const detail = requisitionGroupOptions(params.id);
    await Promise.all([
      requireRight(queryClient, RIGHTS.requisitionGroupsManage),
      cause === 'stay'
        ? queryClient.ensureQueryData(detail)
        : queryClient.fetchQuery({ ...detail, staleTime: 0 }),
    ]);
    prefetchRequisitionGroupLookups(queryClient);
  },
  pendingComponent: EditGroupPending,
  errorComponent: EditGroupError,
  component: EditGroupPage,
});
function EditGroupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(requisitionGroupOptions(id));
  const [saved] = useState(() => data);
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
      id={id}
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
  return (
    <RequisitionGroupEditorSkeleton description={t('requisition-groups.form.edit-description')} />
  );
}
function EditGroupError(props: ErrorComponentProps) {
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
  if (!isNotFound(props.error))
    return (
      <ErrorFallback
        {...props}
        back={back}
        title={t('requisition-groups.form.load-group-error-title')}
        description={t('requisition-groups.form.load-group-error-description')}
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
            <EmptyTitle>{t('requisition-groups.form.not-found-title')}</EmptyTitle>
            <EmptyDescription>
              {t('requisition-groups.form.not-found-description')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{back}</EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
