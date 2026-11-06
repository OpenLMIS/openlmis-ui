import { expect, it } from 'vitest';
import { prepareAccess } from '@/features/buq/lib/access';
import { parsePermissions } from '@/lib/permissions';

const BUQ = { id: 'g1', code: 'BUQ', name: 'BUQ' };
const HOME = { id: 'f1', name: 'Cuamba', supportedPrograms: [{ id: 'g1', code: 'BUQ' }] };
const GRANTED = parsePermissions(['PREPARE_BUQ|f1|g1']);

it('opens for the BUQ program supported and granted at the home facility', () => {
  expect(prepareAccess({ home: HOME, programs: [BUQ], permissions: GRANTED })).toEqual({
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
  expect(prepareAccess(sources)).toEqual({ kind });
});
