import type { NamedItem } from '@/features/buq/lib/types';
import { hasProgramGrant, type Permissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';

export const BUQ_CODE = 'BUQ';

type HomeFacility = {
  id: string;
  name: string | null;
  supportedPrograms?: readonly {
    id: string;
    code: string;
    supportActive?: boolean;
    supportStartDate?: string | null;
  }[];
};

type ProgramRecord = { id: string; code: string; name: string | null };

export type PrepareAccess =
  | { kind: 'ready'; facility: NamedItem; program: NamedItem }
  | { kind: 'no-home' }
  | { kind: 'no-program' }
  | { kind: 'unsupported' }
  | { kind: 'no-grant' };

export function prepareAccess({
  home,
  programs,
  permissions,
  today,
}: {
  home: HomeFacility | undefined;
  programs: readonly ProgramRecord[];
  permissions: Permissions;
  today: string;
}): PrepareAccess {
  if (!home) return { kind: 'no-home' };
  const program = programs.find(({ code }) => code === BUQ_CODE);
  if (!program) return { kind: 'no-program' };
  const supported = home.supportedPrograms?.some(
    ({ id, supportActive, supportStartDate }) =>
      id === program.id &&
      supportActive !== false &&
      (!supportStartDate || supportStartDate.slice(0, 10) < today),
  );
  if (!supported) return { kind: 'unsupported' };
  if (!hasProgramGrant(permissions, RIGHTS.prepareBuq, home.id, program.id)) {
    return { kind: 'no-grant' };
  }
  return {
    kind: 'ready',
    facility: { id: home.id, name: home.name ?? '' },
    program: { id: program.id, name: program.name ?? program.code },
  };
}
