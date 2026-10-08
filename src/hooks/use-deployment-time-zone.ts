import { useSuspenseQuery } from '@tanstack/react-query';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';

export function useDeploymentTimeZone() {
  return useSuspenseQuery(deploymentTimeZoneOptions()).data;
}
