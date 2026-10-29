import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
  minimalFacilitiesOptions,
  supervisoryNodesByIdsOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import {
  supervisoryNodeOptions,
  supervisoryNodesPageOptions,
} from '@/features/supervisory-nodes/api/queries';
import {
  NodeEditor,
  NodeEditorSkeleton,
} from '@/features/supervisory-nodes/components/node-editor';
import { nodeEditSearchSchema } from '@/features/supervisory-nodes/lib/edit-search';
import { toSupervisoryNodesQuery } from '@/features/supervisory-nodes/lib/search';
import { visibleSavedIds } from '@/features/supervisory-nodes/lib/visible-saved-ids';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/supervisory-nodes_/$id',
)({
  validateSearch: nodeEditSearchSchema,
  staticData: { crumbKey: 'supervisory-nodes.edit-title' },
  preload: false,
  loaderDeps: ({ search }) => ({
    childPage: search.childPage ?? 1,
    childSize: search.childSize ?? 10,
    partnerPage: search.partnerPage ?? 1,
    partnerSize: search.partnerSize ?? 10,
  }),
  loader: async ({ context: { queryClient }, params, cause, deps }) => {
    const detail = supervisoryNodeOptions(params.id);
    const [, saved] = await Promise.all([
      requireRight(queryClient, RIGHTS.supervisoryNodesManage).then(() => {
        queryClient.prefetchQuery(supervisoryNodesOptions());
        queryClient.prefetchQuery(minimalFacilitiesOptions());
      }),
      cause === 'stay'
        ? queryClient.ensureQueryData(detail)
        : queryClient.fetchQuery({ ...detail, staleTime: 0 }),
    ]);
    if (cause === 'stay') return;
    for (const [kind, rows] of [
      ['child', saved.childNodes],
      ['partner', saved.partnerNodes],
    ] as const) {
      const savedIds = new Set(rows.map(({ id }) => id));
      queryClient.prefetchQuery(
        supervisoryNodesByIdsOptions(
          visibleSavedIds(rows, deps[`${kind}Page`], deps[`${kind}Size`], savedIds),
        ),
      );
    }
  },
  pendingComponent: NodeEditorSkeleton,
  errorComponent: EditNodeError,
  component: EditNodePage,
});

function EditNodePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const { id } = Route.useParams();
  const { data: node } = useSuspenseQuery(supervisoryNodeOptions(id));
  const [revision, setRevision] = useState(0);
  const [listSearch] = useState(() => router.state.location.state.supervisoryNodesListSearch ?? {});
  const backToList = useCallback(
    () => navigate({ to: '/administration/supervisory-nodes', search: listSearch }),
    [navigate, listSearch],
  );
  return (
    <NodeEditor
      key={`${node.id}:${revision}`}
      saved={node}
      onCancel={backToList}
      onReload={async () => {
        const scope = getSessionScope();
        await queryClient.fetchQuery({ ...supervisoryNodeOptions(id), staleTime: 0 });
        assertSessionScope(scope);
        setRevision((value) => value + 1);
      }}
      onSaved={async (updated) => {
        const scope = getSessionScope();
        await backToList();
        assertSessionScope(scope);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.supervisoryNodes.all,
          refetchType: 'none',
        });
        assertSessionScope(scope);
        void queryClient.refetchQueries({
          queryKey: supervisoryNodesPageOptions(toSupervisoryNodesQuery(listSearch)).queryKey,
          exact: true,
          type: 'active',
        });
        toast.success(t('supervisory-nodes.form.saved-title'), {
          description: t('supervisory-nodes.form.saved-description', { name: updated.name }),
        });
      }}
    />
  );
}

function EditNodeError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  if (!isNotFound(props.error)) {
    return (
      <ErrorFallback
        {...props}
        description={t('supervisory-nodes.form.load-error-description')}
        title={t('supervisory-nodes.form.load-error-title')}
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
            <EmptyTitle>{t('supervisory-nodes.not-found-title')}</EmptyTitle>
            <EmptyDescription>{t('supervisory-nodes.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link to="/administration/supervisory-nodes" />}
              variant="outline"
            >
              {t('supervisory-nodes.not-found-back')}
            </Button>
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
