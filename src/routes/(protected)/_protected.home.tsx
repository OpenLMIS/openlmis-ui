import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Workspace,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceTitle,
} from '@/components/workspace';

export const Route = createFileRoute('/(protected)/_protected/home')({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();

  return (
    <Workspace>
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceTitle>{t('home.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('home.description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      {/* TODO: Add WorkspaceContent once there are home widgets to show. */}
    </Workspace>
  );
}
