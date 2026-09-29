import { queryOptions } from '@tanstack/react-query';
import { fetchAppConfiguration } from '@/features/system-settings/api/api';
import { queryKeys } from '@/lib/key-factory';

export const appConfigurationOptions = () =>
  queryOptions({
    queryKey: queryKeys.appConfiguration.detail('current'),
    queryFn: fetchAppConfiguration,
    staleTime: 0,
  });
