import type { AxiosRequestConfig } from 'axios';
import { client } from '@/integrations/axios';

const TIME_ZONE_KEY = 'openlmis-ui.time-zone';

export const storedTimeZone = () => localStorage.getItem(TIME_ZONE_KEY);

export async function fetchDeploymentTimeZone(config?: AxiosRequestConfig): Promise<string> {
  const { data } = await client.get<{ timeZoneId?: string | null }>('/localeSettings', {
    ...config,
    baseURL: '/',
    anonymous: true,
    connectionStatus: false,
    timeout: 10_000,
  });
  return readDeploymentTimeZone(data);
}

export function readDeploymentTimeZone(data: { timeZoneId?: string | null }): string {
  if (typeof data?.timeZoneId !== 'string' || !data.timeZoneId.trim())
    throw new Error('No time zone in the locale settings');
  new Intl.DateTimeFormat('en', { timeZone: data.timeZoneId });
  localStorage.setItem(TIME_ZONE_KEY, data.timeZoneId);
  return data.timeZoneId;
}

export async function prepareDeploymentTimeZone(
  config?: AxiosRequestConfig,
  onFallback?: () => void,
): Promise<string> {
  try {
    return await fetchDeploymentTimeZone(config);
  } catch (error) {
    if (config?.signal?.aborted) throw error;
    const stored = storedTimeZone();
    const zone = stored ?? 'UTC';
    localStorage.setItem(TIME_ZONE_KEY, zone);
    if (!stored) onFallback?.();
    return zone;
  }
}
