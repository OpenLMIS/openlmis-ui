import type { BuqStatus } from '@/features/buq/lib/types';

export type ForecastAction = 'save' | 'submit' | 'authorize' | 'submitAndAuthorize';

export type ForecastRights = { create: boolean; authorize: boolean };

const OPEN_FOR_CREATE: readonly BuqStatus[] = ['DRAFT', 'REJECTED'];

export function forecastActions(
  status: BuqStatus,
  { create, authorize }: ForecastRights,
  skipAuthorization: boolean,
): ForecastAction[] {
  if (skipAuthorization) {
    return create && (OPEN_FOR_CREATE.includes(status) || status === 'SUBMITTED')
      ? ['save', 'submitAndAuthorize']
      : [];
  }
  if (create && OPEN_FOR_CREATE.includes(status)) return ['save', 'submit'];
  if (authorize && status === 'SUBMITTED') return ['save', 'authorize'];
  return [];
}

export const canViewRejection = (status: BuqStatus, { create }: ForecastRights) =>
  create && status === 'REJECTED';
