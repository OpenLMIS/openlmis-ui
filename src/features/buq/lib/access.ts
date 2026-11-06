import type { NamedRecord } from '@/features/buq/lib/types';
import { hasProgramGrant, type Permissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';

export const BUQ_CODE = 'BUQ';

type HomeFacility = {
  id: string;
  name: string | null;
  supportedPrograms?: readonly { id: string; code: string }[];
};

type ProgramRecord = { id: string; code: string; name: string | null };

export type PrepareAccess =
  | { kind: 'ready'; facility: NamedRecord; program: NamedRecord }
  | { kind: 'no-home' | 'no-program' | 'unsupported' | 'no-grant' };

export function prepareAccess({
  home,
  programs,
  permissions,
}: {
  home: HomeFacility | undefined;
  programs: readonly ProgramRecord[];
  permissions: Permissions;
}): PrepareAccess {
  if (!home) return { kind: 'no-home' };
  const program = programs.find(({ code }) => code === BUQ_CODE);
  if (!program) return { kind: 'no-program' };
  if (!home.supportedPrograms?.some(({ id }) => id === program.id)) return { kind: 'unsupported' };
  if (!hasProgramGrant(permissions, RIGHTS.prepareBuq, home.id, program.id)) {
    return { kind: 'no-grant' };
  }
  return {
    kind: 'ready',
    facility: { id: home.id, name: home.name ?? '' },
    program: { id: program.id, name: program.name ?? program.code },
  };
}
