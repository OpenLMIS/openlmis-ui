import type { BuqStatus } from '@/features/buq/lib/types';

export type ForecastAction =
  | 'save'
  | 'submit'
  | 'authorize'
  | 'submitAndAuthorize'
  | 'approve'
  | 'finalApprove'
  | 'reject';

export type ForecastRights = { create: boolean; authorize: boolean };

export type ForecastMode =
  | { kind: 'create'; rights: ForecastRights; skipAuthorization: boolean }
  | { kind: 'approve'; programId: string }
  | { kind: 'national'; programId: string; zoneIds: readonly string[] };

const OPEN_FOR_CREATE: readonly BuqStatus[] = ['DRAFT', 'REJECTED'];
const OPEN_FOR_APPROVAL: readonly BuqStatus[] = ['AUTHORIZED', 'IN_APPROVAL'];

export function forecastActions(status: BuqStatus, mode: ForecastMode): ForecastAction[] {
  if (mode.kind === 'approve') {
    return OPEN_FOR_APPROVAL.includes(status) ? ['approve', 'reject'] : [];
  }
  if (mode.kind === 'national') return status === 'APPROVED' ? ['finalApprove', 'reject'] : [];
  const { create, authorize } = mode.rights;
  if (mode.skipAuthorization) {
    return create && (OPEN_FOR_CREATE.includes(status) || status === 'SUBMITTED')
      ? ['save', 'submitAndAuthorize']
      : [];
  }
  if (create && OPEN_FOR_CREATE.includes(status)) return ['save', 'submit'];
  if (authorize && status === 'SUBMITTED') return ['save', 'authorize'];
  return [];
}

export const canViewRejection = (status: BuqStatus, mode: ForecastMode) =>
  mode.kind === 'create' && mode.rights.create && status === 'REJECTED';
