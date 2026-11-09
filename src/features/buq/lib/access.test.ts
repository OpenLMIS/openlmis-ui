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
  skipAuthorization: false,
};

it.each([
  ['PREPARE_BUQ', PREPARE, ['PREPARE_BUQ|f1|g1'], ['PREPARE_BUQ']],
  ['CREATE_FORECASTING alone', FORECASTING, ['CREATE_FORECASTING|f1|g1'], ['CREATE_FORECASTING']],
  [
    'AUTHORIZE_FORECASTING alone',
    FORECASTING,
    ['AUTHORIZE_FORECASTING|f1|g1', 'CREATE_FORECASTING|f2|g1'],
    ['AUTHORIZE_FORECASTING'],
  ],
  [
    'both forecasting rights',
    FORECASTING,
    ['CREATE_FORECASTING|f1|g1', 'AUTHORIZE_FORECASTING|f1|g1'],
    FORECASTING,
  ],
])('opens with %s granted for BUQ at the home facility', (_, rights, grants, granted) => {
  expect(
    buqAccess({
      home: HOME,
      programs: [BUQ],
      permissions: parsePermissions(grants),
      rights,
      support: { activeOn: TODAY },
    }),
  ).toEqual({ ...READY, granted });
});

const SUPPORTLESS_HOME = { ...HOME, supportedPrograms: [] };

it.each([
  ['no home facility', 'no-home', undefined, [BUQ], ['PREPARE_BUQ|f1|g1'], PREPARE],
  ['no BUQ program', 'no-program', HOME, [], ['PREPARE_BUQ|f1|g1'], PREPARE],
  ['home without BUQ', 'unsupported', SUPPORTLESS_HOME, [BUQ], ['PREPARE_BUQ|f1|g1'], PREPARE],
  ['PREPARE_BUQ elsewhere', 'no-grant', HOME, [BUQ], ['PREPARE_BUQ|f2|g1'], PREPARE],
  ['another right at home', 'no-grant', HOME, [BUQ], ['CREATE_FORECASTING|f1|g1'], PREPARE],
  [
    'forecasting rights elsewhere',
    'no-grant',
    HOME,
    [BUQ],
    ['CREATE_FORECASTING|f2|g1', 'AUTHORIZE_FORECASTING|f1|g2'],
    FORECASTING,
  ],
])('refuses with %s', (_, kind, home, programs, grants, rights) => {
  expect(
    buqAccess({
      home,
      programs,
      permissions: parsePermissions(grants),
      rights,
      support: { activeOn: TODAY },
    }),
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
      support: { activeOn: TODAY },
    }),
  ).toEqual({ ...READY, granted: PREPARE });
});

it('refuses a home grant held for another program or another right', () => {
  expect(
    buqAccess({
      home: HOME,
      programs: [BUQ],
      permissions: parsePermissions(['PREPARE_BUQ|f1|g0']),
      rights: PREPARE,
      support: { activeOn: TODAY },
    }),
  ).toEqual({ kind: 'no-grant' });
  expect(
    buqAccess({
      home: HOME,
      programs: [BUQ],
      permissions: parsePermissions(['PREPARE_BUQ|f2|g1', 'APPROVE_BUQ|f1|g1']),
      rights: PREPARE,
      support: { activeOn: TODAY },
    }),
  ).toEqual({ kind: 'no-grant' });
});

const NOT_YET_SUPPORTED: [string, { supportActive: boolean; supportStartDate?: string }][] = [
  ['inactive', { supportActive: false }],
  ['starting today', { supportActive: true, supportStartDate: TODAY }],
  ['starting later', { supportActive: true, supportStartDate: '2027-01-01' }],
];

it.each(NOT_YET_SUPPORTED)('refuses preparing BUQ when support is %s', (_, support) => {
  expect(
    buqAccess({
      home: { ...HOME, supportedPrograms: [{ id: 'g1', code: 'BUQ', ...support }] },
      programs: [BUQ],
      permissions: parsePermissions(['PREPARE_BUQ|f1|g1']),
      rights: PREPARE,
      support: { activeOn: TODAY },
    }),
  ).toEqual({ kind: 'unsupported' });
});

it.each(NOT_YET_SUPPORTED)('still lists forecasts when support is %s', (_, support) => {
  expect(
    buqAccess({
      home: { ...HOME, supportedPrograms: [{ id: 'g1', code: 'BUQ', ...support }] },
      programs: [BUQ],
      permissions: parsePermissions(['CREATE_FORECASTING|f1|g1']),
      rights: FORECASTING,
      support: 'listed',
    }),
  ).toEqual({ ...READY, granted: ['CREATE_FORECASTING'] });
});
