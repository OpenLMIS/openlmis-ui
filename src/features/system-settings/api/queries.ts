import { queryOptions } from '@tanstack/react-query';
import { fetchAppConfiguration } from '@/features/system-settings/api/api';
import { rememberAppConfiguration } from '@/lib/app-configuration';
import { queryKeys } from '@/lib/key-factory';

export const appConfigurationOptions = () =>
  queryOptions({
    queryKey: queryKeys.appConfiguration.detail('current'),
    queryFn: async ({ signal }) => {
      const configuration = await fetchAppConfiguration();
      if (configuration && !signal.aborted) rememberAppConfiguration(configuration);
      return configuration;
    },
    staleTime: 0,
  });
