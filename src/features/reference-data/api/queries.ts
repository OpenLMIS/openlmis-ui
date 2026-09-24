import { queryOptions } from '@tanstack/react-query';
import {
  fetchMinimalFacilities,
  fetchPrograms,
  fetchRoles,
  fetchSupervisoryNodes,
} from '@/features/reference-data/api/api';
import { queryKeys } from '@/lib/key-factory';

// Lookups that rarely change, so one fetch serves every screen for a while.
const LOOKUP_STALE_TIME = 10 * 60 * 1000;

export const minimalFacilitiesOptions = () =>
  queryOptions({
    queryKey: [...queryKeys.facilities.all, 'minimal'] as const,
    queryFn: fetchMinimalFacilities,
    staleTime: LOOKUP_STALE_TIME,
  });

export const rolesOptions = () =>
  queryOptions({
    queryKey: queryKeys.roles.list(),
    queryFn: fetchRoles,
    staleTime: LOOKUP_STALE_TIME,
  });

export const programsOptions = () =>
  queryOptions({
    queryKey: queryKeys.programs.list(),
    queryFn: fetchPrograms,
    staleTime: LOOKUP_STALE_TIME,
  });

export const supervisoryNodesOptions = () =>
  queryOptions({
    queryKey: queryKeys.supervisoryNodes.list(),
    queryFn: fetchSupervisoryNodes,
    staleTime: LOOKUP_STALE_TIME,
  });
