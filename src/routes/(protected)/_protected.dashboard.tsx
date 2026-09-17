import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Workspace,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace';

export const Route = createFileRoute('/(protected)/_protected/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();

  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('dashboard.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('dashboard.description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      {/* TODO: Add WorkspaceContent once there are dashboard widgets to show. */}
    </Workspace>
  );
}
