import type { QueryClient } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import {
  minimalFacilitiesOptions,
  programsOptions,
  requisitionGroupOptions,
  rolesOptions,
  supervisoryNodesByIdsOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { supervisoryNodesWithRight } from '@/lib/supervisory-nodes';

export async function requisitionReferences(
  client: QueryClient,
  userId: string,
  config?: AxiosRequestConfig,
) {
  const scope = getSessionScope();
  const [user, roles, facilities, programs, userPrograms] = await Promise.all([
    client.fetchQuery(userRecordOptions(userId, config)),
    client.fetchQuery(rolesOptions(config)),
    client.fetchQuery(minimalFacilitiesOptions(config)),
    client.fetchQuery(programsOptions(config)),
    client.fetchQuery(userProgramsOptions(userId, config)),
  ]);
  assertSessionScope(scope);
  const sets = [
    supervisoryNodesWithRight(user, roles, RIGHTS.requisitionView),
    ...programs.map((program) =>
      supervisoryNodesWithRight(user, roles, RIGHTS.requisitionApprove, program.id),
    ),
  ];
  const results = await Promise.all(
    sets.map((ids) => client.fetchQuery(supervisoryNodesByIdsOptions(ids, config))),
  );
  assertSessionScope(scope);
  const nodes = [...new Map(results.flat().map((node) => [node.id, node])).values()];
  const partnerIds = [
    ...new Set(results[0].flatMap((node) => (node.partnerNodeOf ? [node.partnerNodeOf.id] : []))),
  ];
  const partners = await client.fetchQuery(supervisoryNodesByIdsOptions(partnerIds, config));
  assertSessionScope(scope);
  const allNodes = [...new Map([...nodes, ...partners].map((node) => [node.id, node])).values()];
  if ([...sets.flat(), ...partnerIds].some((id) => !allNodes.some((node) => node.id === id)))
    throw new Error('Missing supervisory node');
  const groupIds = [
    ...new Set(
      allNodes.flatMap((node) => (node.requisitionGroup ? [node.requisitionGroup.id] : [])),
    ),
  ];
  const groups = await Promise.all(
    groupIds.map((id) => client.fetchQuery(requisitionGroupOptions(id, config))),
  );
  assertSessionScope(scope);
  return { roles, facilities, programs, userPrograms, nodes: allNodes, groups };
}
