import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import {
  SystemSettingsLayout,
  SystemSettingsPending,
} from '@/features/system-settings/components/system-settings-workspace';
import { getFlag } from '@/lib/feature-flags';

export const Route = createFileRoute('/(protected)/_protected/settings')({
  loader: async ({ context: { queryClient } }) => {
    if (!getFlag('SYSTEM_SETTINGS')) throw notFound();
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
