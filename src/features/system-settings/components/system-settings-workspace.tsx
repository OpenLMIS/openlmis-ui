import { Link, useLocation } from '@tanstack/react-router';
import { SlidersHorizontalIcon } from 'lucide-react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';

const SYSTEM_SETTINGS_TABS = [
  { to: '/administration/system-settings', labelKey: 'system-settings.tabs.branding' },
  { to: '/administration/system-settings/theme', labelKey: 'system-settings.tabs.theme' },
  {
    to: '/administration/system-settings/feature-flags',
    labelKey: 'system-settings.tabs.feature-flags',
  },
] as const;

const FooterSlot = createContext<HTMLElement | null>(null);

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
  const { pathname } = useLocation();
  const tab =
    SYSTEM_SETTINGS_TABS.find(({ to }) => pathname.replace(/\/$/, '') === to)?.to ??
    SYSTEM_SETTINGS_TABS[0].to;
  const [footerSlot, setFooterSlot] = useState<HTMLElement | null>(null);

  return (
    <FooterSlot value={footerSlot}>
      <Workspace width="narrow">
        <SystemSettingsHeader />
        <WorkspaceContent>
          <Tabs spacing="page" value={tab}>
            <div className="@container">
              <TabsList aria-label={t('system-settings.tabs-label')} wrap>
                {SYSTEM_SETTINGS_TABS.map((item) => (
                  <TabsTrigger
                    key={item.to}
                    nativeButton={false}
                    render={<Link to={item.to} />}
                    value={item.to}
                  >
                    {t(item.labelKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value={tab}>{children}</TabsContent>
          </Tabs>
        </WorkspaceContent>
      </Workspace>
      <div className="contents" ref={setFooterSlot} />
    </FooterSlot>
  );
}

export function SystemSettingsFooter({ children }: { children: ReactNode }) {
  const slot = useContext(FooterSlot);
  return slot
    ? createPortal(<WorkspaceFooter width="narrow">{children}</WorkspaceFooter>, slot)
    : null;
}
