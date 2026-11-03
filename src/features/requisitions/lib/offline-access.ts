import type { QueryClient } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { liveQuery } from 'dexie';
import {
  fetchMinimalFacilities,
  fetchPrograms,
  fetchRequisitionGroup,
  fetchRoles,
  fetchSupervisoryNodesByIds,
} from '@/features/reference-data/api/api';
import {
  LOOKUP_STALE_TIME,
  minimalFacilitiesOptions,
  programsOptions,
  requisitionGroupOptions,
  rolesOptions,
  supervisoryNodesByIdsOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import type {
  MinimalFacility,
  Program,
  RequisitionGroup,
  Role,
  SupervisoryNode,
} from '@/features/reference-data/lib/types';
import type { RequisitionCopy } from '@/features/requisitions/lib/offline-copies';
import {
  groupIdsOf,
  partnerNodeIds,
  searchFacilityOptions,
} from '@/features/requisitions/lib/search-facilities';
import { LOCAL_TABLES } from '@/integrations/local-db';
import { defineDownloadProvider } from '@/lib/download-provider';
import { LocalDataUnavailableError, onlineOrDevice } from '@/lib/local-data';
import { requireOwnedRecord } from '@/lib/local-records';
import { offlineAccessQuery, readOfflineAccess } from '@/lib/offline-access';
import { OFFLINE_FRESH_FOR } from '@/lib/offline-freshness';
import { isOnline } from '@/lib/online';
import { parsePermissions, programGrants } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import { isSecureOrigin } from '@/lib/secure-context';
import { assertSessionScope, getSessionScope, subscribeSessionScope } from '@/lib/session-scope';
import { supervisoryNodesWithRight } from '@/lib/supervisory-nodes';

export type RequisitionAccess = {
  userId: string;
  generation: string;
  fetchedAt: number;
  formatVersion: 1;
  roles: Role[];
  nodes: SupervisoryNode[];
  groups: RequisitionGroup[];
  facilities: MinimalFacility[];
  programs: Program[];
};
export async function readRequisitionAccess() {
  if (!isSecureOrigin) throw new LocalDataUnavailableError();
  const access = await readOfflineAccess();
  const saved = await requireOwnedRecord<RequisitionAccess>(
    LOCAL_TABLES.requisitionAccess,
    access.userId,
    {
      formats: [1],
      accept: (record) => record.generation === access.generation,
    },
  );
  return { access, saved };
}
export async function waitForRequisitionAccess() {
  const session = getSessionScope();
  try {
    return await readRequisitionAccess();
  } catch (error) {
    if (!(error instanceof LocalDataUnavailableError)) throw error;
  }
  assertSessionScope(session);
  return new Promise<Awaited<ReturnType<typeof readRequisitionAccess>>>((resolve, reject) => {
    let stop = () => {};
    const timer = setTimeout(() => {
      stop();
      reject(new LocalDataUnavailableError());
    }, 30_000);
    const unsubscribe = subscribeSessionScope(() => {
      stop();
      try {
        assertSessionScope(session);
      } catch (error) {
        reject(error);
      }
    });
    const subscription = liveQuery(async () => {
      try {
        return await readRequisitionAccess();
      } catch (error) {
        if (!(error instanceof LocalDataUnavailableError)) throw error;
        return undefined;
      }
    }).subscribe({
      next: (data) => {
        if (data) {
          stop();
          resolve(data);
        }
      },
      error: (error) => {
        stop();
        reject(error);
      },
    });
    stop = () => {
      clearTimeout(timer);
      unsubscribe();
      subscription.unsubscribe();
    };
  });
}
export function viewChoices({ access, saved }: Awaited<ReturnType<typeof readRequisitionAccess>>) {
  const permissions = parsePermissions(access.permissionStrings);
  const viewNodes = saved.nodes.filter((n) =>
    supervisoryNodesWithRight(access.user, saved.roles, RIGHTS.requisitionView).includes(n.id),
  );
  const partners = saved.nodes.filter((n) => partnerNodeIds(viewNodes).includes(n.id));
  return searchFacilityOptions(
    programGrants(permissions, RIGHTS.requisitionView),
    saved.facilities,
    saved.programs,
    saved.groups.filter((g) => groupIdsOf(partners).includes(g.id)),
  );
}
export function mayViewCopy(
  data: Awaited<ReturnType<typeof readRequisitionAccess>>,
  facilityId: string,
  programId: string,
) {
  return viewChoices(data).some(
    (f) => f.id === facilityId && f.programs.some((p) => p.id === programId),
  );
}
export function mayApproveCopy(
  data: Awaited<ReturnType<typeof readRequisitionAccess>>,
  facilityId: string,
  programId: string,
  nodeId?: string | null,
) {
  const nodes = supervisoryNodesWithRight(
    data.access.user,
    data.saved.roles,
    RIGHTS.requisitionApprove,
    programId,
  );
  if (nodeId) return nodes.includes(nodeId);
  return data.saved.nodes.some(
    (node) =>
      nodes.includes(node.id) &&
      data.saved.groups.some(
        (group) =>
          group.id === node.requisitionGroup?.id &&
          group.memberFacilities.some((f) => f.id === facilityId),
      ),
  );
}
export function mayApproveSavedCopy(
  data: Awaited<ReturnType<typeof readRequisitionAccess>>,
  copy: Pick<RequisitionCopy, 'summary'> & {
    batch?: Pick<NonNullable<RequisitionCopy['batch']>, 'approvalNodes'>;
  },
) {
  if (copy.summary.supervisoryNode || !copy.batch)
    return mayApproveCopy(
      data,
      copy.summary.facility.id,
      copy.summary.program.id,
      copy.summary.supervisoryNode,
    );
  const current = supervisoryNodesWithRight(
    data.access.user,
    data.saved.roles,
    RIGHTS.requisitionApprove,
    copy.summary.program.id,
  );
  return (
    copy.batch.approvalNodes.length > 0 &&
    copy.batch.approvalNodes.every((node) => current.includes(node))
  );
}
export const requisitionAccessProvider = defineDownloadProvider({
  id: 'requisition-access',
  label: 'requisitions.view.title',
  table: LOCAL_TABLES.requisitionAccess,
  refreshOn: ['sign-in', 'periodic', 'force'],
  scopes: (access) =>
    access.permissionStrings.some((permission) =>
      [RIGHTS.requisitionView, RIGHTS.requisitionApprove].includes(permission.split('|')[0]),
    ) || access.user.roleAssignments.some((assignment) => !!assignment.supervisoryNodeId)
      ? [{ id: access.userId, name: '', key: access.userId }]
      : [],
  fetch: async (_scope, signal): Promise<RequisitionAccess> => {
    const session = getSessionScope();
    const access = await readOfflineAccess();
    const check = () => {
      assertSessionScope(session);
      signal.throwIfAborted();
    };
    check();
    const [roles, facilities, programs] = await Promise.all([
      fetchRoles({ signal }),
      fetchMinimalFacilities(),
      fetchPrograms(),
    ]);
    check();
    const ids = [
      ...new Set([
        ...supervisoryNodesWithRight(access.user, roles, RIGHTS.requisitionView),
        ...supervisoryNodesWithRight(access.user, roles, RIGHTS.requisitionApprove),
      ]),
    ];
    const nodes = await fetchSupervisoryNodesByIds(ids);
    check();
    if (ids.some((id) => !nodes.some((node) => node.id === id)))
      throw new LocalDataUnavailableError();
    const partnerIds = partnerNodeIds(nodes).filter((id) => !ids.includes(id));
    const partners = await fetchSupervisoryNodesByIds(partnerIds);
    if (partnerIds.some((id) => !partners.some((node) => node.id === id)))
      throw new LocalDataUnavailableError();
    check();
    const allNodes = [...nodes, ...partners];
    const groups = await Promise.all(groupIdsOf(allNodes).map(fetchRequisitionGroup));
    check();
    return {
      userId: access.userId,
      generation: access.generation,
      fetchedAt: Date.now(),
      formatVersion: 1,
      roles,
      facilities,
      programs,
      nodes: allNodes,
      groups,
    };
  },
  accepts: (record, access) =>
    record.formatVersion === 1 && record.generation === access.generation,
  isFresh: (record, access) =>
    !!record &&
    record.generation === access.generation &&
    Date.now() - record.fetchedAt < OFFLINE_FRESH_FOR,
});
export async function prepareRequisitionAccess(client: QueryClient, force = false) {
  if (isOnline() && !force) return;
  const { access, saved } = await readRequisitionAccess();
  client.setQueryData(rolesOptions().queryKey, saved.roles);
  client.setQueryData(minimalFacilitiesOptions().queryKey, saved.facilities);
  client.setQueryData(programsOptions().queryKey, saved.programs);
  client.setQueryData(userRecordOptions(access.userId).queryKey, access.user);
  client.setQueryData(userProgramsOptions(access.userId).queryKey, access.programs);
  const seedNodes = (ids: string[]) =>
    client.setQueryData(
      supervisoryNodesByIdsOptions(ids).queryKey,
      ids.map((id) => saved.nodes.find((n) => n.id === id)).filter((n) => n !== undefined),
    );
  const viewIds = supervisoryNodesWithRight(access.user, saved.roles, RIGHTS.requisitionView);
  seedNodes(viewIds);
  seedNodes(partnerNodeIds(saved.nodes.filter((n) => viewIds.includes(n.id))));
  seedNodes([]);
  for (const program of saved.programs)
    seedNodes(
      supervisoryNodesWithRight(access.user, saved.roles, RIGHTS.requisitionApprove, program.id),
    );
  for (const group of saved.groups)
    client.setQueryData(requisitionGroupOptions(group.id).queryKey, group);
}
export const requisitionNodesOptions = (ids: readonly string[]) => ({
  ...supervisoryNodesByIdsOptions(ids),
  queryFn: () =>
    onlineOrDevice(
      () => fetchSupervisoryNodesByIds(ids),
      async () => {
        const { saved } = await readRequisitionAccess();
        const nodes = ids.map((id) => saved.nodes.find((node) => node.id === id));
        if (nodes.some((node) => !node)) throw new LocalDataUnavailableError();
        return nodes.filter((node) => node !== undefined);
      },
    ),
});

export const requisitionRolesOptions = (config?: AxiosRequestConfig) => ({
  ...rolesOptions(config),
  queryFn: () =>
    onlineOrDevice(
      () => fetchRoles(config),
      async () => (await readRequisitionAccess()).saved.roles,
    ),
  ...offlineAccessQuery(LOOKUP_STALE_TIME),
});
