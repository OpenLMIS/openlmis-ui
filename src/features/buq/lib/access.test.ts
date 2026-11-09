import { expect, it } from 'vitest';
import { buqAccess } from '@/features/buq/lib/access';
import { parsePermissions } from '@/lib/permissions';

const BUQ = { id: 'g1', code: 'BUQ', name: 'BUQ' };
const HOME = { id: 'f1', name: 'Cuamba', supportedPrograms: [{ id: 'g1', code: 'BUQ' }] };
const PREPARE = ['PREPARE_BUQ'];
const TODAY = '2026-11-12';
const FORECASTING = ['CREATE_FORECASTING', 'AUTHORIZE_FORECASTING'];
const READY = {
  kind: 'ready',
  facility: { id: 'f1', name: 'Cuamba' },
  program: { id: 'g1', name: 'BUQ' },
};

it.each([
  ['PREPARE_BUQ', PREPARE, 'PREPARE_BUQ|f1|g1'],
  ['CREATE_FORECASTING alone', FORECASTING, 'CREATE_FORECASTING|f1|g1'],
  ['AUTHORIZE_FORECASTING alone', FORECASTING, 'AUTHORIZE_FORECASTING|f1|g1'],
])('opens with %s granted for BUQ at the home facility', (_, rights, grant) => {
  expect(
    buqAccess({
      home: HOME,
      programs: [BUQ],
      permissions: parsePermissions([grant]),
      rights,
      today: TODAY,
    }),
  ).toEqual(READY);
});

it.each([
  ['no-home', { home: undefined, programs: [BUQ], grants: ['PREPARE_BUQ|f1|g1'] }],
  ['no-program', { home: HOME, programs: [], grants: ['PREPARE_BUQ|f1|g1'] }],
  [
    'unsupported',
    { home: { ...HOME, supportedPrograms: [] }, programs: [BUQ], grants: ['PREPARE_BUQ|f1|g1'] },
  ],
  ['no-grant', { home: HOME, programs: [BUQ], grants: ['PREPARE_BUQ|f2|g1'] }],
  ['no-grant', { home: HOME, programs: [BUQ], grants: ['CREATE_FORECASTING|f1|g1'] }],
  [
    'no-grant',
    {
      home: HOME,
      programs: [BUQ],
      grants: ['CREATE_FORECASTING|f2|g1', 'AUTHORIZE_FORECASTING|f1|g2'],
    },
    FORECASTING,
  ],
])('refuses with %s', (kind, { home, programs, grants }, rights = PREPARE) => {
  expect(
    buqAccess({ home, programs, permissions: parsePermissions(grants), rights, today: TODAY }),
  ).toEqual({ kind });
});

it('picks the BUQ program among the user programs', () => {
  expect(
    buqAccess({
      home: {
        ...HOME,
        supportedPrograms: [
          { id: 'g0', code: 'EPI' },
          { id: 'g1', code: 'BUQ' },
        ],
      },
      programs: [{ id: 'g0', code: 'EPI', name: 'EPI' }, BUQ],
      permissions: parsePermissions(['PREPARE_BUQ|f1|g1']),
      rights: PREPARE,
      today: TODAY,
    }),
  ).toEqual(READY);
});

it('refuses a home grant held for another program or another right', () => {
  expect(
    buqAccess({
      home: HOME,
      programs: [BUQ],
      permissions: parsePermissions(['PREPARE_BUQ|f1|g0']),
      rights: PREPARE,
      today: TODAY,
    }),
  ).toEqual({ kind: 'no-grant' });
  expect(
    buqAccess({
      home: HOME,
      programs: [BUQ],
      permissions: parsePermissions(['PREPARE_BUQ|f2|g1', 'APPROVE_BUQ|f1|g1']),
      rights: PREPARE,
      today: TODAY,
    }),
  ).toEqual({ kind: 'no-grant' });
});

it.each([
  ['inactive', { supportActive: false }],
  ['starting today', { supportActive: true, supportStartDate: TODAY }],
  ['starting later', { supportActive: true, supportStartDate: '2027-01-01' }],
])('refuses BUQ support that is %s', (_, support) => {
  expect(
    buqAccess({
      home: { ...HOME, supportedPrograms: [{ id: 'g1', code: 'BUQ', ...support }] },
      programs: [BUQ],
      permissions: parsePermissions(['PREPARE_BUQ|f1|g1']),
      rights: PREPARE,
      today: TODAY,
    }),
  ).toEqual({ kind: 'unsupported' });
});
