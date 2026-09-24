import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  minimalFacilitiesOptions,
  programsOptions,
  rolesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import type { RoleLookups } from '@/features/users/lib/role-assignments';

const byId = <T extends { id: string }>(items: T[] | undefined) =>
  items && new Map(items.map((item) => [item.id, item]));

/** Suspends on roles and programs; nodes and facilities are slow and fill in later. */
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
  // Names still on their way show as placeholders, and ones that failed as a dash, never "Unknown".
  const status = useMemo(
    () =>
      ({
        nodes: nodes.isPending ? 'pending' : nodes.isError ? 'failed' : 'ready',
        facilities: facilities.isPending ? 'pending' : facilities.isError ? 'failed' : 'ready',
      }) as const,
    [nodes.isPending, nodes.isError, facilities.isPending, facilities.isError],
  );
  const { refetch: refetchNodes } = nodes;
  const { refetch: refetchFacilities } = facilities;
  const retry = useCallback(() => {
    if (status.nodes === 'failed') void refetchNodes();
    if (status.facilities === 'failed') void refetchFacilities();
  }, [status, refetchNodes, refetchFacilities]);

  return { lookups, status, retry };
}

export type LookupStatus = ReturnType<typeof useRoleLookups>['status'];
