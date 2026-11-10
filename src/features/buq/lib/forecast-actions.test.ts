import { expect, it } from 'vitest';
import {
  canViewRejection,
  type ForecastAction,
  type ForecastMode,
  forecastActions,
} from '@/features/buq/lib/forecast-actions';
import type { BuqStatus } from '@/features/buq/lib/types';

const create = (create: boolean, authorize: boolean, skipAuthorization = false): ForecastMode => ({
  kind: 'create',
  rights: { create, authorize },
  skipAuthorization,
});

const CREATE = create(true, false);
const AUTHORIZE = create(false, true);
const APPROVE: ForecastMode = { kind: 'approve' };

const CASES: [string, BuqStatus, ForecastMode, ForecastAction[]][] = [
  ['Draft with create', 'DRAFT', CREATE, ['save', 'submit']],
  ['Rejected with create', 'REJECTED', CREATE, ['save', 'submit']],
  ['Submitted with authorize', 'SUBMITTED', AUTHORIZE, ['save', 'authorize']],
  ['Submitted with create only', 'SUBMITTED', CREATE, []],
  ['Draft with authorize only', 'DRAFT', AUTHORIZE, []],
  ['skip, Draft with create', 'DRAFT', create(true, false, true), ['save', 'submitAndAuthorize']],
  [
    'skip, Submitted with create',
    'SUBMITTED',
    create(true, false, true),
    ['save', 'submitAndAuthorize'],
  ],
  ['skip, Submitted with authorize only', 'SUBMITTED', create(false, true, true), []],
  ['Authorized with both', 'AUTHORIZED', create(true, true), []],
  ['approve, Authorized', 'AUTHORIZED', APPROVE, ['approve', 'reject']],
  ['approve, In Approval', 'IN_APPROVAL', APPROVE, ['approve', 'reject']],
  ['approve, Submitted', 'SUBMITTED', APPROVE, []],
  ['approve, Approved', 'APPROVED', APPROVE, []],
];

it.each(CASES)('%s', (_, status, mode, actions) => {
  expect(forecastActions(status, mode)).toEqual(actions);
});

it('shows the rejection reasons only to a creator of a Rejected forecast', () => {
  expect(canViewRejection('REJECTED', CREATE)).toBe(true);
  expect(canViewRejection('REJECTED', AUTHORIZE)).toBe(false);
  expect(canViewRejection('DRAFT', CREATE)).toBe(false);
  expect(canViewRejection('REJECTED', APPROVE)).toBe(false);
});
