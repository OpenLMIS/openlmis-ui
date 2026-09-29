import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ServerOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Workspace, WorkspaceContent } from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import {
  SystemSettingsHeader,
  SystemSettingsWorkspace,
} from '@/features/system-settings/components/system-settings-workspace';

export const Route = createFileRoute('/(protected)/_protected/administration/system-settings')({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      requireRight(queryClient, RIGHTS.systemSettingsManage),
      queryClient.ensureQueryData(appConfigurationOptions()),
    ]);
  },
  pendingComponent: SystemSettingsPending,
  component: SystemSettingsLayout,
});

function SystemSettingsLayout() {
  const { data: saved } = useSuspenseQuery(appConfigurationOptions());
  if (!saved) return <SystemSettingsUnavailable />;
  return (
    <SystemSettingsWorkspace>
      <Outlet />
    </SystemSettingsWorkspace>
  );
}

function SystemSettingsPending() {
  return (
    <Workspace width="narrow">
      <SystemSettingsHeader />
      <WorkspaceContent>
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
      </WorkspaceContent>
    </Workspace>
  );
}

function SystemSettingsUnavailable() {
  const { t } = useTranslation();

  return (
    <Workspace width="narrow">
      <SystemSettingsHeader />
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ServerOffIcon />
            </EmptyMedia>
            <EmptyTitle>{t('system-settings.unavailable-title')}</EmptyTitle>
            <EmptyDescription>{t('system-settings.unavailable-description')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
