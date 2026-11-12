import { expect, it } from 'vitest';
import { prepareAccess } from '@/features/buq/lib/access';
import { parsePermissions } from '@/lib/permissions';

const BUQ = { id: 'g1', code: 'BUQ', name: 'BUQ' };
const HOME = { id: 'f1', name: 'Cuamba', supportedPrograms: [{ id: 'g1', code: 'BUQ' }] };
const GRANTED = parsePermissions(['PREPARE_BUQ|f1|g1']);
const TODAY = '2026-11-12';

it('opens for the BUQ program supported and granted at the home facility', () => {
  expect(
    prepareAccess({ home: HOME, programs: [BUQ], permissions: GRANTED, today: TODAY }),
  ).toEqual({
    kind: 'ready',
    facility: { id: 'f1', name: 'Cuamba' },
    program: { id: 'g1', name: 'BUQ' },
  });
});

it.each([
  ['no-home', { home: undefined, programs: [BUQ], permissions: GRANTED }],
  ['no-program', { home: HOME, programs: [], permissions: GRANTED }],
  [
    'unsupported',
    { home: { ...HOME, supportedPrograms: [] }, programs: [BUQ], permissions: GRANTED },
  ],
  [
    'no-grant',
    { home: HOME, programs: [BUQ], permissions: parsePermissions(['PREPARE_BUQ|f2|g1']) },
  ],
])('refuses with %s', (kind, sources) => {
  expect(prepareAccess({ ...sources, today: TODAY })).toEqual({ kind });
});

it('picks the BUQ program among the user programs', () => {
  expect(
    prepareAccess({
      home: {
        ...HOME,
        supportedPrograms: [
          { id: 'g0', code: 'EPI' },
          { id: 'g1', code: 'BUQ' },
        ],
      },
      programs: [{ id: 'g0', code: 'EPI', name: 'EPI' }, BUQ],
      permissions: GRANTED,
      today: TODAY,
    }),
  ).toEqual({
    kind: 'ready',
    facility: { id: 'f1', name: 'Cuamba' },
    program: { id: 'g1', name: 'BUQ' },
  });
});

it('refuses a home grant held for another program or another right', () => {
  expect(
    prepareAccess({
      home: HOME,
      programs: [BUQ],
      permissions: parsePermissions(['PREPARE_BUQ|f1|g0']),
      today: TODAY,
    }),
  ).toEqual({ kind: 'no-grant' });
  expect(
    prepareAccess({
      home: HOME,
      programs: [BUQ],
      permissions: parsePermissions(['PREPARE_BUQ|f2|g1', 'APPROVE_BUQ|f1|g1']),
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
    prepareAccess({
      home: { ...HOME, supportedPrograms: [{ id: 'g1', code: 'BUQ', ...support }] },
      programs: [BUQ],
      permissions: GRANTED,
      today: TODAY,
    }),
  ).toEqual({ kind: 'unsupported' });
});
