import type { QueryClient } from '@tanstack/react-query';
import { type ErrorComponentProps, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Workspace, WorkspaceContent } from '@/components/workspace/workspace';
import { requisitionGroupOptions } from '@/features/reference-data/api/queries';
import type { RequisitionGroupEditorSearch } from '@/features/requisition-groups/lib/members';
import { isNotFound } from '@/lib/http';
import type { SearchChange } from '@/lib/table-search';

export async function loadRequisitionGroup(
  queryClient: QueryClient,
  id: string,
  cause: 'enter' | 'stay' | 'preload',
) {
  const detail = requisitionGroupOptions(id);
  const saved = await (cause === 'stay'
    ? queryClient.ensureQueryData(detail)
    : queryClient.fetchQuery({ ...detail, staleTime: 0 }));
  return { saved, readAt: queryClient.getQueryState(detail.queryKey)?.dataUpdatedAt };
}

export function useRequisitionGroupNavigation(
  from:
    | '/administration/requisition-groups/$id/edit'
    | '/administration/requisition-groups/$id'
    | '/administration/requisition-groups/new',
) {
  const router = useRouter();
  const navigate = useNavigate({ from });
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
        to: '.',
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
  return { backToList, onSearchChange };
}

function RequisitionGroupsBack() {
  const { t } = useTranslation();
  const router = useRouter();
  const listSearch = router.state.location.state.requisitionGroupsListSearch ?? {};
  return (
    <Button
      nativeButton={false}
      render={<Link to="/administration/requisition-groups" search={listSearch} />}
      variant="outline"
    >
      {t('requisition-groups.form.back')}
    </Button>
  );
}

export function RequisitionGroupRouteError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  if (!isNotFound(props.error))
    return (
      <ErrorFallback
        {...props}
        back={<RequisitionGroupsBack />}
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
          <EmptyContent>
            <RequisitionGroupsBack />
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}

export function AddRequisitionGroupRouteError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ErrorFallback
      {...props}
      back={<RequisitionGroupsBack />}
      title={t('requisition-groups.form.open-error-title')}
      description={t('requisition-groups.form.load-group-error-description')}
    />
  );
}
