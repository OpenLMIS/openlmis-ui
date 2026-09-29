import { SlidersHorizontalIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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

const SYSTEM_SETTINGS_TABS = [
  { to: '/administration/system-settings', labelKey: 'system-settings.tabs.branding' },
  { to: '/administration/system-settings/theme', labelKey: 'system-settings.tabs.theme' },
  {
    to: '/administration/system-settings/feature-flags',
    labelKey: 'system-settings.tabs.feature-flags',
  },
] as const;

export function SystemSettingsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <SlidersHorizontalIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('system-settings.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('system-settings.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

export function SystemSettingsWorkspace({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <WorkspaceFooterScope>
      <Workspace width="narrow">
        <SystemSettingsHeader />
        <WorkspaceContent>
          <WorkspaceTabs
            label={t('system-settings.tabs-label')}
            tabs={SYSTEM_SETTINGS_TABS.map(({ to, labelKey }) => ({ to, label: t(labelKey) }))}
          >
            {children}
          </WorkspaceTabs>
        </WorkspaceContent>
      </Workspace>
    </WorkspaceFooterScope>
  );
}
