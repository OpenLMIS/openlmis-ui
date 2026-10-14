import { createFileRoute } from '@tanstack/react-router';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import {
  DeviceEventsPage,
  deviceEventsSearchSchema,
} from '@/features/stock-events/components/device-events';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import type { TableSearch } from '@/lib/table-search';

export const Route = createFileRoute('/(protected)/_protected/stock-management/device-events')({
  validateSearch: deviceEventsSearchSchema,
  staticData: { crumbKey: 'device-events.title' },
  loader: async ({ context: { queryClient } }) => {
    await requireRight(queryClient, RIGHTS.stockAdjust);
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
  },
  component: DeviceEvents,
});
function DeviceEvents() {
  const { updateSearch } = useSearchNavigation<TableSearch>({});
  return <DeviceEventsPage search={Route.useSearch()} onSearchChange={updateSearch} />;
}
