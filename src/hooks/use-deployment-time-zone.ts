import { queryOptions, useQuery } from '@tanstack/react-query';
import { client } from '@/integrations/axios';
import { queryKeys } from '@/lib/key-factory';

type LocaleSettings = { timeZoneId?: string | null };

export const localeSettingsOptions = () =>
  queryOptions({
    queryKey: queryKeys.localeSettings.all,
    queryFn: async () => {
      const { data } = await client.get<LocaleSettings>('/localeSettings', {
        baseURL: '/',
        anonymous: true,
      });
      return data;
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

export function useDeploymentTimeZone() {
  return useQuery(localeSettingsOptions()).data?.timeZoneId ?? undefined;
}
