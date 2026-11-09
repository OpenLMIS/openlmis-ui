import { QueryClient } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import type { fetchUserRecord } from '@/features/reference-data/api/api';
import {
  minimalFacilitiesOptions,
  programsOptions,
  requisitionGroupOptions,
  rolesOptions,
  supervisoryNodesByIdsOptions,
} from '@/features/reference-data/api/queries';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import { supervisoryNodesWithRight } from '@/lib/supervisory-nodes';

export async function requisitionReferences(
  client: QueryClient,
  user: Awaited<ReturnType<typeof fetchUserRecord>>,
  config?: AxiosRequestConfig,
) {
  const sessionClient = client;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, networkMode: 'always' } },
  });
  const scope = getSessionScope();
  const [facilities, programs, roles] = await Promise.all([
    sessionClient.fetchQuery(minimalFacilitiesOptions(config)),
    sessionClient.fetchQuery(programsOptions(config)),
    client.fetchQuery(rolesOptions(config)),
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
    throw new LocalDataUnavailableError();
  const groupIds = [
    ...new Set(
      allNodes.flatMap((node) => (node.requisitionGroup ? [node.requisitionGroup.id] : [])),
    ),
  ];
  const groups = await Promise.all(
    groupIds.map((id) => client.fetchQuery(requisitionGroupOptions(id, config))),
  );
  assertSessionScope(scope);
  return { roles, facilities, programs, nodes: allNodes, groups };
}
