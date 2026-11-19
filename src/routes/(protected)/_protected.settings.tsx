import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';
import { requireRouteRights } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { appConfigurationOptions } from '@/features/system-settings/api/queries';
import {
  SystemSettingsLayout,
  SystemSettingsPending,
} from '@/features/system-settings/components/system-settings-workspace';
import { getFlag } from '@/lib/feature-flags';

export const Route = createFileRoute('/(protected)/_protected/settings')({
  staticData: { rights: [RIGHTS.systemSettingsManage] },
  loader: async ({ route, context: { queryClient } }) => {
    if (!getFlag('SYSTEM_SETTINGS')) throw notFound();
    await Promise.all([
      requireRouteRights(queryClient, route),
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
