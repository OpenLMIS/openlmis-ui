import { queryOptions } from '@tanstack/react-query';
import { fetchSystemNotifications } from '@/features/system-notifications/api/api';
import { queryKeys } from '@/lib/key-factory';

export const SYSTEM_NOTIFICATIONS_STALE_TIME = 30_000;

export const systemNotificationsOptions = () =>
  queryOptions({
    queryKey: queryKeys.systemNotifications.list({ displayed: true }),
    queryFn: ({ signal }) => fetchSystemNotifications({ signal }),
    networkMode: 'online',
    refetchOnWindowFocus: true,
    staleTime: SYSTEM_NOTIFICATIONS_STALE_TIME,
  });
