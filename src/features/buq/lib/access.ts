import type { NamedItem } from '@/features/buq/lib/types';
import { hasProgramGrant, type Permissions } from '@/lib/permissions';

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

type ProgramRecord = {
  id: string;
  code: string;
  name: string | null;
  skipAuthorization?: boolean;
};

export type BuqAccess =
  | {
      kind: 'ready';
      facility: NamedItem;
      program: NamedItem;
      granted: readonly string[];
      skipAuthorization: boolean;
    }
  | { kind: 'no-home' }
  | { kind: 'no-program' }
  | { kind: 'unsupported' }
  | { kind: 'no-grant' };

export type BuqSupport = { activeOn: string } | 'listed';

export function buqAccess({
  home,
  programs,
  permissions,
  rights,
  support,
}: {
  home: HomeFacility | undefined;
  programs: readonly ProgramRecord[];
  permissions: Permissions;
  rights: readonly string[];
  support: BuqSupport;
}): BuqAccess {
  if (!home) return { kind: 'no-home' };
  const program = programs.find(({ code }) => code === BUQ_CODE);
  if (!program) return { kind: 'no-program' };
  const supported = home.supportedPrograms?.some(
    ({ id, supportActive, supportStartDate }) =>
      id === program.id &&
      (support === 'listed' ||
        (supportActive !== false &&
          (!supportStartDate || supportStartDate.slice(0, 10) < support.activeOn))),
  );
  if (!supported) return { kind: 'unsupported' };
  const granted = rights.filter((right) =>
    hasProgramGrant(permissions, right, home.id, program.id),
  );
  if (!granted.length) return { kind: 'no-grant' };
  return {
    kind: 'ready',
    facility: { id: home.id, name: home.name ?? '' },
    program: { id: program.id, name: program.name ?? program.code },
    granted,
    skipAuthorization: !!program.skipAuthorization,
  };
}

type ApproveAccess = { kind: 'ready'; programId: string } | { kind: 'no-program' };

export function approveAccess(programs: readonly ProgramRecord[]): ApproveAccess {
  const program = programs.find(({ code }) => code === BUQ_CODE);
  return program ? { kind: 'ready', programId: program.id } : { kind: 'no-program' };
}
