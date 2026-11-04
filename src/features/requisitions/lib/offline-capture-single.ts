import type { QueryClient } from '@tanstack/react-query';
import {
  facilityOptions,
  orderablesByIdentitiesOptions,
} from '@/features/reference-data/api/queries';
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
import { type CopyLease, commitCopy } from '@/features/requisitions/lib/offline-copies';
import { singleComplete, singleSummary } from '@/features/requisitions/lib/offline-single';
import type { RequisitionRecord } from '@/features/requisitions/lib/types';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { assertSessionScope } from '@/lib/session-scope';

export async function captureSingle(
  client: QueryClient,
  lease: CopyLease,
  record: RequisitionRecord,
  accessMode: 'wait' | 'read' = 'wait',
) {
  const [productsQuery, approvedQuery, periodQuery, currencyQuery, programQuery] =
    requisitionGridQueries(record);
  const [lineProducts, approved, facility, period, currency, program, messages, unskip] =
    await Promise.all([
      client.ensureQueryData(productsQuery),
      client.ensureQueryData(approvedQuery),
      client.ensureQueryData(facilityOptions(record.facility.id)),
      client.ensureQueryData(periodQuery),
      client.ensureQueryData(currencyQuery),
      client.ensureQueryData(programQuery),
      client.fetchQuery({ ...requisitionStatusMessagesOptions(record.id), staleTime: 0 }),
      ['AUTHORIZED', 'IN_APPROVAL'].includes(record.status)
        ? client.ensureQueryData(unskipSettingOptions())
        : Promise.resolve(undefined),
    ]);
  assertSessionScope(lease.session);
  const missing = (record.availableProducts ?? []).filter(
    (identity) =>
      !lineProducts.some(
        (product) =>
          product.id === identity.id && product.meta?.versionNumber === identity.versionNumber,
      ),
  );
  const availableProducts = missing.length
    ? await client.ensureQueryData(orderablesByIdentitiesOptions(missing))
    : [];
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
