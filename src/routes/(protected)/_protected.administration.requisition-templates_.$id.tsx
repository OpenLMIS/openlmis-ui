import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Workspace,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';

export const Route = createFileRoute(
  '/(protected)/_protected/administration/requisition-templates_/$id',
)({
  loader: ({ context: { queryClient } }) =>
    requireRight(queryClient, RIGHTS.requisitionTemplatesManage),
  component: ConfigurePlaceholder,
});

function ConfigurePlaceholder() {
  const { t } = useTranslation();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('requisition-templates.configure')}</WorkspaceTitle>
          <WorkspaceDescription>{t('requisition-templates.description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
    </Workspace>
  );
}
