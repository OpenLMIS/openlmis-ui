import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { permissionsOptions } from '@/features/auth/api/queries';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { useLoginData } from '@/features/auth/store/login-data';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import {
  DeviceEventsPage,
  deviceEventsSearchSchema,
} from '@/features/stock-events/components/device-events';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { hasOwnDeviceEvents } from '@/lib/device-event-access';
import { parsePermissions } from '@/lib/permissions';
import type { TableSearch } from '@/lib/table-search';

export const Route = createFileRoute('/(protected)/_protected/stock-management/device-events')({
  validateSearch: deviceEventsSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    if (!(await hasOwnDeviceEvents())) await requireRight(queryClient, RIGHTS.stockAdjust);
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
  },
  component: DeviceEvents,
});
function DeviceEvents() {
  const userId = useLoginData((state) => state.referenceDataUserId) ?? '';
  const { data: permissions, dataUpdatedAt } = useQuery(permissionsOptions(userId));
  const { updateSearch } = useSearchNavigation<TableSearch>({});
  return (
    <DeviceEventsPage
      permissions={permissions ?? parsePermissions([])}
      permissionsUpdatedAt={dataUpdatedAt}
      search={Route.useSearch()}
      onSearchChange={updateSearch}
    />
  );
}
