import { queryOptions } from '@tanstack/react-query';
import { client } from '@/integrations/axios';
import { queryKeys } from '@/lib/key-factory';
import type { Page } from '@/lib/types';

/** The id, code and name the API lists for every facility, enough to pick one. */
export type MinimalFacility = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

/** Every facility in one request; the endpoint is meant for pickers and has no paging worth using. */
export async function fetchMinimalFacilities(): Promise<MinimalFacility[]> {
  const { data } = await client.get<Page<MinimalFacility>>('/facilities/minimal');
  return data.content;
}

export const minimalFacilitiesOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.facilities.all, 'minimal'] as const,
    queryFn: fetchMinimalFacilities,
    // Thousands of rows that rarely change, so one fetch serves every picker for a while.
    staleTime: 10 * 60 * 1000,
  });
