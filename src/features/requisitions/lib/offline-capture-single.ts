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
import { withRequestPriority } from '@/lib/background-request-gate';
import { BY_IDS_BATCH } from '@/lib/fetch-by-ids';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { assertSessionScope } from '@/lib/session-scope';

export async function captureSingle(
  client: QueryClient,
  lease: CopyLease,
  record: RequisitionRecord,
  accessMode: 'wait' | 'read' = 'wait',
  { freshMessages = false }: { freshMessages?: boolean } = {},
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
      freshMessages
        ? client.fetchQuery({ ...requisitionStatusMessagesOptions(record.id), staleTime: 0 })
        : client.ensureQueryData(requisitionStatusMessagesOptions(record.id)),
      ['AUTHORIZED', 'IN_APPROVAL'].includes(record.status)
        ? client.ensureQueryData(unskipSettingOptions())
        : Promise.resolve(undefined),
    ]);
  assertSessionScope(lease.session);
  const known = new Set(
    lineProducts.map((product) => `${product.id}:${product.meta?.versionNumber}`),
  );
  const missing = (record.availableProducts ?? []).filter(
    (identity) => !known.has(`${identity.id}:${identity.versionNumber}`),
  );
  const availableProducts: typeof lineProducts = [];
  if (missing.length) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve());
          else setTimeout(resolve, 32);
        }),
      );
    });
    assertSessionScope(lease.session);
    for (let start = 0; start < missing.length; start += BY_IDS_BATCH) {
      availableProducts.push(
        ...(await withRequestPriority(
          true,
          undefined,
          () => {
            assertSessionScope(lease.session);
            return client.ensureQueryData(
              orderablesByIdentitiesOptions(missing.slice(start, start + BY_IDS_BATCH)),
            );
          },
          'requisition-copy',
        )),
      );
      assertSessionScope(lease.session);
    }
  }
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
