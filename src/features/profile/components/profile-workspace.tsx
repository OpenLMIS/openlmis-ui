import { Link } from '@tanstack/react-router';
import { KeyRoundIcon, UserRoundIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Block } from '@/components/skeleton-block';
import { Button } from '@/components/ui/button';
import {
  Workspace,
  WorkspaceActions,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { WorkspaceSlots, WorkspaceTabs } from '@/components/workspace-tabs';
import { markDialogOpened } from '@/hooks/use-search-navigation';

const PROFILE_TABS = [
  { to: '/profile', labelKey: 'profile.tabs.basic' },
  { to: '/profile/roles', labelKey: 'profile.tabs.roles' },
  { to: '/profile/notifications', labelKey: 'profile.tabs.notifications' },
] as const;

type ProfileWorkspaceProps = {
  /** Left out while the profile loads, which holds the places of the name and Change Password. */
  username?: string;
  children: ReactNode;
};

/** The page around every profile tab, kept mounted across tabs so focus stays on the tab list. */
export function ProfileWorkspace({ username, children }: ProfileWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <WorkspaceSlots>
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
          <WorkspaceTabs
            label={t('profile.tabs-label')}
            tabs={PROFILE_TABS.map(({ to, labelKey }) => ({ to, label: t(labelKey) }))}
          >
            {children}
          </WorkspaceTabs>
        </WorkspaceContent>
      </Workspace>
    </WorkspaceSlots>
  );
}
