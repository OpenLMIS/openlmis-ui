import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Workspace,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/supervisory-nodes_/$id',
)({
  loader: ({ context: { queryClient } }) =>
    requireRight(queryClient, RIGHTS.supervisoryNodesManage),
  component: SupervisoryNodePlaceholder,
});

function SupervisoryNodePlaceholder() {
  const { t } = useTranslation();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('supervisory-nodes.edit-title')}</WorkspaceTitle>
        </WorkspaceHeading>
      </WorkspaceHeader>
    </Workspace>
  );
}
