import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
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
import {
  minimalFacilitiesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import {
  supervisoryNodeOptions,
  supervisoryNodesByIdsOptions,
} from '@/features/supervisory-nodes/api/queries';
import {
  NodeEditor,
  NodeEditorSkeleton,
} from '@/features/supervisory-nodes/components/node-editor';
import { nodeEditSearchSchema } from '@/features/supervisory-nodes/lib/edit-search';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/supervisory-nodes_/$id',
)({
  validateSearch: nodeEditSearchSchema,
  staticData: { crumbKey: 'supervisory-nodes.edit-title' },
  preload: false,
  loader: async ({ context: { queryClient }, params, cause }) => {
    const detail = supervisoryNodeOptions(params.id);
    const [, saved] = await Promise.all([
      requireRight(queryClient, RIGHTS.supervisoryNodesManage),
      cause === 'stay'
        ? queryClient.ensureQueryData(detail)
        : queryClient.fetchQuery({ ...detail, staleTime: 0 }),
    ]);
    const ids = [
      ...new Set([
        ...saved.childNodes.map(({ id }) => id),
        ...saved.partnerNodes.map(({ id }) => id),
        ...(saved.parentNode ? [saved.parentNode.id] : []),
      ]),
    ].sort();
    queryClient.prefetchQuery(supervisoryNodesByIdsOptions(ids));
    queryClient.prefetchQuery(supervisoryNodesOptions());
    queryClient.prefetchQuery(minimalFacilitiesOptions());
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
      onSaved={(updated) => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.supervisoryNodes.all });
        toast.success(t('supervisory-nodes.form.saved-title'), {
          description: t('supervisory-nodes.form.saved-description', { name: updated.name }),
        });
        void backToList();
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
