import { queryOptions } from '@tanstack/react-query';
import { fetchSystemNotifications } from '@/features/system-notifications/api/api';
import { queryKeys } from '@/lib/key-factory';

export const systemNotificationsOptions = () =>
  queryOptions({
    queryKey: queryKeys.systemNotifications.list({ displayed: true }),
    queryFn: ({ signal }) => fetchSystemNotifications({ signal }),
    refetchOnWindowFocus: true,
  });
