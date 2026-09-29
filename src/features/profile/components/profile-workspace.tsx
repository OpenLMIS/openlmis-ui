import { Link, useLocation } from '@tanstack/react-router';
import { KeyRoundIcon, UserRoundIcon } from 'lucide-react';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Block } from '@/components/skeleton-block';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { markDialogOpened } from '@/hooks/use-search-navigation';

const PROFILE_TABS = [
  { to: '/profile', labelKey: 'profile.tabs.basic' },
  { to: '/profile/roles', labelKey: 'profile.tabs.roles' },
  { to: '/profile/notifications', labelKey: 'profile.tabs.notifications' },
] as const;

const FooterSlot = createContext<HTMLElement | null>(null);

type ProfileWorkspaceProps = {
  /** Left out while the profile loads, which holds the places of the name and Change Password. */
  username?: string;
  /** The open tab's page. */
  children: ReactNode;
};

/** The page around every profile tab, kept mounted across tabs so focus stays on the tab list. */
export function ProfileWorkspace({ username, children }: ProfileWorkspaceProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const tab = PROFILE_TABS.find(({ to }) => pathname.replace(/\/$/, '') === to)?.to ?? '/profile';
  const [footerSlot, setFooterSlot] = useState<HTMLElement | null>(null);

  return (
    <FooterSlot value={footerSlot}>
      <Workspace width="narrow">
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <UserRoundIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>{t('profile.title')}</WorkspaceTitle>
            <WorkspaceDescription>
              {username === undefined ? (
                <Block className="h-5 w-48 py-0.5" />
              ) : (
                t('profile.description', { username })
              )}
            </WorkspaceDescription>
          </WorkspaceHeading>
          <WorkspaceActions>
            {username === undefined ? (
              <Block className="h-9 w-40" />
            ) : (
              <Button
                nativeButton={false}
                render={
                  <Link
                    search={(previous) => ({ ...previous, dialog: 'password' as const })}
                    state={markDialogOpened}
                    to="."
                  />
                }
                size="lg"
                variant="outline"
              >
                <KeyRoundIcon data-icon="inline-start" />
                {t('profile.password.title')}
              </Button>
            )}
          </WorkspaceActions>
        </WorkspaceHeader>
        <WorkspaceContent>
          {/* Each tab is a page of its own, so it is a link: Back and a new tab land on it. */}
          <Tabs spacing="page" value={tab}>
            <div className="@container">
              <TabsList aria-label={t('profile.tabs-label')} wrap>
                {PROFILE_TABS.map((item) => (
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
      {/* Where a tab that edits puts its Save and Cancel; `contents` lets the footer stick. */}
      <div className="contents" ref={setFooterSlot} />
    </FooterSlot>
  );
}

/** Save and Cancel for a tab that edits, in the bar stuck to the bottom of the window. */
export function ProfileFooter({ children }: { children: ReactNode }) {
  const slot = useContext(FooterSlot);
  return slot
    ? createPortal(<WorkspaceFooter width="narrow">{children}</WorkspaceFooter>, slot)
    : null;
}
