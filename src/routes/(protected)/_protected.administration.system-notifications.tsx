import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Workspace,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { requireRouteRights } from '@/features/auth/lib/access';
import { RIGHTS } from '@/lib/rights';

export const Route = createFileRoute('/(protected)/_protected/administration/system-notifications')(
  {
    staticData: { rights: [RIGHTS.systemNotificationsManage] },
    loader: async ({ context: { queryClient }, route }) => {
      await requireRouteRights(queryClient, route);
    },
    component: SystemNotificationsPage,
  },
);

function SystemNotificationsPage() {
  const { t } = useTranslation();
  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('nav.administration.system-notifications')}</WorkspaceTitle>
        </WorkspaceHeading>
      </WorkspaceHeader>
    </Workspace>
  );
}
