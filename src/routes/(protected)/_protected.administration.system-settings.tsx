import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import {
  SystemSettingsLayout,
  SystemSettingsPending,
} from '@/features/system-settings/components/system-settings-workspace';

export const Route = createFileRoute('/(protected)/_protected/administration/system-settings')({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      requireRight(queryClient, RIGHTS.systemSettingsManage),
      queryClient.ensureQueryData(appConfigurationOptions()),
    ]);
  },
  pendingComponent: SystemSettingsPending,
  component: () => (
    <SystemSettingsLayout>
      <Outlet />
    </SystemSettingsLayout>
  ),
});
