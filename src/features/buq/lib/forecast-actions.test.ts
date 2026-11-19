import { expect, it } from 'vitest';
import {
  canViewRejection,
  type ForecastAction,
  type ForecastRights,
  forecastActions,
} from '@/features/buq/lib/forecast-actions';
import type { BuqStatus } from '@/features/buq/lib/types';

const CREATE = { create: true, authorize: false };
const AUTHORIZE = { create: false, authorize: true };

const CASES: [string, BuqStatus, ForecastRights, boolean, ForecastAction[]][] = [
  ['Draft with create', 'DRAFT', CREATE, false, ['save', 'submit']],
  ['Rejected with create', 'REJECTED', CREATE, false, ['save', 'submit']],
  ['Submitted with authorize', 'SUBMITTED', AUTHORIZE, false, ['save', 'authorize']],
  ['Submitted with create only', 'SUBMITTED', CREATE, false, []],
  ['Draft with authorize only', 'DRAFT', AUTHORIZE, false, []],
  ['skip, Draft with create', 'DRAFT', CREATE, true, ['save', 'submitAndAuthorize']],
  ['skip, Submitted with create', 'SUBMITTED', CREATE, true, ['save', 'submitAndAuthorize']],
  ['skip, Submitted with authorize only', 'SUBMITTED', AUTHORIZE, true, []],
  ['Authorized with both', 'AUTHORIZED', { create: true, authorize: true }, false, []],
];

it.each(CASES)('%s', (_, status, rights, skip, actions) => {
  expect(forecastActions(status, rights, skip)).toEqual(actions);
});

it('shows the rejection reasons only to a creator of a Rejected forecast', () => {
  expect(canViewRejection('REJECTED', CREATE)).toBe(true);
  expect(canViewRejection('REJECTED', AUTHORIZE)).toBe(false);
  expect(canViewRejection('DRAFT', CREATE)).toBe(false);
});
