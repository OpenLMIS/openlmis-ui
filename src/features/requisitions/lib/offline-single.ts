import { type QueryClient, queryOptions } from '@tanstack/react-query';
import type { OrderableIdentity } from '@/features/reference-data/api/api';
import {
  fetchApprovedProductsByIdentities,
  type fetchCurrencySettings,
  type fetchFacility,
  fetchOrderablesByIdentities,
  type fetchProcessingPeriod,
  type fetchProgramLookup,
} from '@/features/reference-data/api/api';
import {
  approvedProductsByIdentitiesOptions,
  currencySettingsOptions,
  deploymentTimeZoneOptions,
  facilityOptions,
  orderablesByIdentitiesOptions,
  processingPeriodOptions,
  programLookupOptions,
} from '@/features/reference-data/api/queries';
import type { fetchStatusMessages, fetchUnskipSetting } from '@/features/requisitions/api/api';
import {
  requisitionGridQueries,
  requisitionStatusMessagesOptions,
  unskipSettingOptions,
} from '@/features/requisitions/api/queries';
import {
  mayViewCopy,
  readRequisitionAccess,
  waitForRequisitionAccess,
} from '@/features/requisitions/lib/offline-access';
import {
  type CopyLease,
  type CopySummary,
  commitCopy,
  completeSingle,
  newerServerRecord,
  readCopy,
} from '@/features/requisitions/lib/offline-copies';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { readDeploymentTimeZone } from '@/lib/deployment-time-zone';
import { queryKeys } from '@/lib/key-factory';
import { LocalDataUnavailableError, onlineOrDevice } from '@/lib/local-data';
import { assertSessionScope } from '@/lib/session-scope';

export type SingleReferences = {
  products: Awaited<ReturnType<typeof fetchOrderablesByIdentities>>;
  approved: Awaited<ReturnType<typeof fetchApprovedProductsByIdentities>>;
  facility: Awaited<ReturnType<typeof fetchFacility>>;
  period: Awaited<ReturnType<typeof fetchProcessingPeriod>>;
  currency: Awaited<ReturnType<typeof fetchCurrencySettings>>;
  program: Awaited<ReturnType<typeof fetchProgramLookup>>;
  messages: Awaited<ReturnType<typeof fetchStatusMessages>>;
  unskip?: Awaited<ReturnType<typeof fetchUnskipSetting>>;
};
const matches = (
  identities: readonly OrderableIdentity[],
  records: readonly { id: string; meta?: { versionNumber?: number } }[],
) =>
  identities.every((identity) =>
    records.some((r) => r.id === identity.id && r.meta?.versionNumber === identity.versionNumber),
  );
export const singleComplete = completeSingle;
export function singleSummary(
  record: RequisitionRecord,
  refs: Pick<SingleReferences, 'facility' | 'period' | 'program'>,
): CopySummary {
  return {
    id: record.id,
    status: record.status,
    emergency: record.emergency,
    createdDate: record.createdDate,
    facility: refs.facility,
    processingPeriod: refs.period,
    program: refs.program,
    supervisoryNode: record.supervisoryNode,
    statusChanges:
      record.statusChanges ??
      Object.fromEntries(
        (record.statusHistory ?? []).map((h) => [h.status, { changeDate: h.createdDate }]),
      ),
    extraData: record.extraData ?? undefined,
  };
}
export async function captureSingle(
  client: QueryClient,
  lease: CopyLease,
  record: RequisitionRecord,
  accessMode: 'wait' | 'read' = 'wait',
) {
  const [productsQuery, approvedQuery, periodQuery, currencyQuery, programQuery] =
    requisitionGridQueries(record);
  const [
    lineProducts,
    availableProducts,
    approved,
    facility,
    period,
    currency,
    program,
    messages,
    unskip,
  ] = await Promise.all([
    client.ensureQueryData(productsQuery),
    client.ensureQueryData(orderablesByIdentitiesOptions(record.availableProducts ?? [])),
    client.ensureQueryData(approvedQuery),
    client.ensureQueryData(facilityOptions(record.facility.id)),
    client.ensureQueryData(periodQuery),
    client.ensureQueryData(currencyQuery),
    client.ensureQueryData(programQuery),
    client.ensureQueryData(requisitionStatusMessagesOptions(record.id)),
    ['AUTHORIZED', 'IN_APPROVAL'].includes(record.status)
      ? client.ensureQueryData(unskipSettingOptions())
      : Promise.resolve(undefined),
  ]);
  const products = [
    ...new Map(
      [...lineProducts, ...availableProducts].map((p) => [`${p.id}:${p.meta?.versionNumber}`, p]),
    ).values(),
  ];
  assertSessionScope(lease.session);
  const references = { products, approved, facility, period, currency, program, messages, unskip };
  if (!singleComplete(record, references)) throw new LocalDataUnavailableError();
  const access = await (accessMode === 'wait'
    ? waitForRequisitionAccess()
    : readRequisitionAccess());
  assertSessionScope(lease.session);
  if (!mayViewCopy(access, facility.id, program.id)) throw new LocalDataUnavailableError();
  await commitCopy(lease, {
    id: record.id,
    userId: lease.userId,
    formatVersion: 1,
    generation: lease.generation,
    revision: 0,
    fetchedAt: Date.now(),
    summary: singleSummary(record, references),
    single: { record, references, fetchedAt: Date.now() },
  });
  assertSessionScope(lease.session);
  return references;
}
export async function readSingle(id: string) {
  const copy = await readCopy(id);
  if (!copy?.single || !singleComplete(copy.single.record, copy.single.references))
    throw new LocalDataUnavailableError();
  const access = await readRequisitionAccess();
  if (!mayViewCopy(access, copy.summary.facility.id, copy.summary.program.id))
    throw new LocalDataUnavailableError();
  const confirmed = copy.batch?.confirmedApproval;
  const single =
    confirmed && !newerServerRecord(copy.single.record, confirmed)
      ? {
          ...copy.single,
          record: {
            ...copy.single.record,
            status: confirmed.status as RequisitionRecord['status'],
            modifiedDate: confirmed.modifiedDate,
          },
        }
      : copy.single;
  return { ...copy, single };
}
export function hydrateSingle(
  client: QueryClient,
  record: RequisitionRecord,
  refs: SingleReferences,
) {
  client.setQueryData(facilityOptions(record.facility.id).queryKey, refs.facility);
  client.setQueryData(processingPeriodOptions(record.processingPeriod.id).queryKey, refs.period);
  client.setQueryData(programLookupOptions(record.program.id).queryKey, refs.program);
  client.setQueryData(currencySettingsOptions().queryKey, refs.currency);
  client.setQueryData(deploymentTimeZoneOptions().queryKey, {
    zone: readDeploymentTimeZone(refs.currency),
    read: true,
  });
  client.setQueryData([...queryKeys.requisitions.all, 'statusMessages', record.id], refs.messages);
  if (refs.unskip) client.setQueryData(queryKeys.requisitionUnskipSetting.all, refs.unskip);
  client.setQueryData(
    orderablesByIdentitiesOptions(record.availableProducts ?? []).queryKey,
    refs.products.filter((p) =>
      (record.availableProducts ?? []).some(
        (i) => i.id === p.id && i.versionNumber === p.meta?.versionNumber,
      ),
    ),
  );
}
export const savedProductsOptions = (id: string, identities: readonly OrderableIdentity[]) => {
  const server = orderablesByIdentitiesOptions(identities);
  return queryOptions({
    ...server,
    queryFn: () =>
      onlineOrDevice(
        () => fetchOrderablesByIdentities(identities),
        async () => {
          const copy = await readSingle(id);
          const products = copy.single.references.products;
          if (!matches(identities, products)) throw new LocalDataUnavailableError();
          return products.filter((p) =>
            identities.some((i) => i.id === p.id && i.versionNumber === p.meta?.versionNumber),
          );
        },
      ),
  });
};
export const savedApprovedOptions = (id: string, identities: readonly OrderableIdentity[]) => {
  const server = approvedProductsByIdentitiesOptions(identities);
  return queryOptions({
    ...server,
    queryFn: () =>
      onlineOrDevice(
        () => fetchApprovedProductsByIdentities(identities),
        async () => {
          const copy = await readSingle(id);
          const approved = copy.single.references.approved;
          if (!matches(identities, approved)) throw new LocalDataUnavailableError();
          return approved.filter((p) =>
            identities.some((i) => i.id === p.id && i.versionNumber === p.meta?.versionNumber),
          );
        },
      ),
  });
};
