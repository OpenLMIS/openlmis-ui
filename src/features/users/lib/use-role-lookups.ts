import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  minimalFacilitiesOptions,
  programsOptions,
  rolesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import type { RoleLookups } from '@/features/users/lib/role-assignments';

const byId = <T extends { id: string }>(items: T[] | undefined) =>
  items && new Map(items.map((item) => [item.id, item]));

/** Suspends on roles and programs, which are quick; nodes and facilities fill in when they arrive. */
export function useRoleLookups() {
  const { data: roles } = useSuspenseQuery(rolesOptions());
  const { data: programs } = useSuspenseQuery(programsOptions());
  const nodes = useQuery(supervisoryNodesOptions());
  const facilities = useQuery(minimalFacilitiesOptions());

  const lookups = useMemo(
    (): RoleLookups => ({
      roles: new Map(roles.map((role) => [role.id, role])),
      programs: new Map(programs.map((program) => [program.id, program])),
      nodes: byId(nodes.data),
      facilities: byId(facilities.data),
    }),
    [roles, programs, nodes.data, facilities.data],
  );

  return {
    lookups,
    /** Names still on their way, shown as placeholders rather than "Unknown". */
    pending: { nodes: nodes.isPending, facilities: facilities.isPending },
  };
}
