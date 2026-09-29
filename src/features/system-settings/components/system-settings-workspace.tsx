import { useSuspenseQuery } from '@tanstack/react-query';
import { ServerOffIcon, SlidersHorizontalIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { WorkspaceFooterScope, WorkspaceTabs } from '@/components/workspace-tabs';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';

const SYSTEM_SETTINGS_TABS = [
  { to: '/administration/system-settings', labelKey: 'system-settings.tabs.branding' },
  { to: '/administration/system-settings/theme', labelKey: 'system-settings.tabs.theme' },
  {
    to: '/administration/system-settings/feature-flags',
    labelKey: 'system-settings.tabs.feature-flags',
  },
] as const;

function SystemSettingsPage({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Workspace width="narrow">
      <WorkspaceHeader>
        <WorkspaceHeading>
          <WorkspaceIcon>
            <SlidersHorizontalIcon />
          </WorkspaceIcon>
          <WorkspaceTitle>{t('system-settings.title')}</WorkspaceTitle>
          <WorkspaceDescription>{t('system-settings.description')}</WorkspaceDescription>
        </WorkspaceHeading>
      </WorkspaceHeader>
      <WorkspaceContent>{children}</WorkspaceContent>
    </Workspace>
  );
}

export function SystemSettingsWorkspace({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <WorkspaceFooterScope>
      <SystemSettingsPage>
        <WorkspaceTabs
          label={t('system-settings.tabs-label')}
          tabs={SYSTEM_SETTINGS_TABS.map(({ to, labelKey }) => ({ to, label: t(labelKey) }))}
        >
          {children}
        </WorkspaceTabs>
      </SystemSettingsPage>
    </WorkspaceFooterScope>
  );
}

export function SystemSettingsLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data: saved } = useSuspenseQuery(appConfigurationOptions());
  if (saved) return <SystemSettingsWorkspace>{children}</SystemSettingsWorkspace>;
  return (
    <SystemSettingsPage>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ServerOffIcon />
          </EmptyMedia>
          <EmptyTitle>{t('system-settings.unavailable-title')}</EmptyTitle>
          <EmptyDescription>{t('system-settings.unavailable-description')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </SystemSettingsPage>
  );
}

export function SystemSettingsPending() {
  return (
    <SystemSettingsPage>
      <div aria-busy className="flex flex-col gap-4">
        <div className="h-8 w-40">
          <Skeleton fill />
        </div>
        <div className="h-32 w-full">
          <Skeleton fill />
        </div>
        <div className="h-40 w-full">
          <Skeleton fill />
        </div>
      </div>
    </SystemSettingsPage>
  );
}
