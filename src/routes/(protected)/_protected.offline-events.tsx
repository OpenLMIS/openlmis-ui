import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useDeviceWork } from '@/components/device-work';
import { permissionsOptions } from '@/features/auth/api/queries';
import { requireRight } from '@/features/auth/lib/access';
import { useLoginData } from '@/features/auth/store/login-data';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { OfflineEventsPage } from '@/features/stock-events/components/offline-events';
import { hasOwnDeviceEvents } from '@/features/stock-events/lib/device-event-access';
import { OFFLINE_EVENT_RIGHTS } from '@/features/stock-events/lib/event-kinds';
import {
  CLOSED_DIALOGS,
  type OfflineEventsSearch,
  offlineEventsSearchSchema,
} from '@/features/stock-events/lib/offline-events-search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { parsePermissions } from '@/lib/permissions';

export const Route = createFileRoute('/(protected)/_protected/offline-events')({
  validateSearch: offlineEventsSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    if (!(await hasOwnDeviceEvents())) await requireRight(queryClient, OFFLINE_EVENT_RIGHTS);
    queryClient.prefetchQuery(deploymentTimeZoneOptions());
  },
  component: OfflineEvents,
});
function OfflineEvents() {
  const { refreshOfflineDownload } = useDeviceWork();
  const userId = useLoginData((state) => state.referenceDataUserId) ?? '';
  const { data: permissions, dataUpdatedAt } = useQuery(permissionsOptions(userId));
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<OfflineEventsSearch>(CLOSED_DIALOGS);
  const onOpenEvent = useCallback((event: string) => void openDialog({ event }), [openDialog]);
  return (
    <OfflineEventsPage
      refreshOfflineDownload={refreshOfflineDownload}
      permissions={permissions ?? parsePermissions([])}
      permissionsUpdatedAt={dataUpdatedAt}
      search={Route.useSearch()}
      onSearchChange={updateSearch}
      onOpenEvent={onOpenEvent}
      onCloseEvent={closeDialog}
    />
  );
}
