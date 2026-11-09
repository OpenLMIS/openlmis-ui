import { toDateValue } from '@/components/form/date-value';
import type { ApprovalSearch } from '@/features/requisitions/lib/approval-search';
import {
  mayApproveSavedCopy,
  mayViewCopy,
  readRequisitionAccess,
} from '@/features/requisitions/lib/offline-access';
import { type RequisitionCopy, readCopies } from '@/features/requisitions/lib/offline-copies';
import type { RequisitionsQuery } from '@/features/requisitions/lib/types';
import { LocalDataUnavailableError } from '@/lib/local-data';
import type { Page } from '@/lib/types';

const timestamp = (value?: string | null) =>
  value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;

export function localPage<T>(rows: T[], page: number, size: number): Page<T> {
  return {
    content: rows.slice(page * size, (page + 1) * size),
    totalElements: rows.length,
    totalPages: Math.ceil(rows.length / size),
    number: page,
    size,
  };
}
export function searchCopies(
  copies: RequisitionCopy[],
  search: RequisitionsQuery,
  timeZone: string,
) {
  const date = (copy: RequisitionCopy) =>
    copy.summary.createdDate ? toDateValue(new Date(copy.summary.createdDate), timeZone) : '';
  const direction = search.sort[0]?.endsWith(',asc') ? 1 : -1;
  return copies
    .filter(
      (copy) =>
        copy.summary.facility.id === search.facility &&
        (!search.program || copy.summary.program.id === search.program) &&
        (!search.requisitionStatus || copy.summary.status === search.requisitionStatus) &&
        (!search.initiatedDateFrom || date(copy) >= search.initiatedDateFrom) &&
        (!search.initiatedDateTo || (!!date(copy) && date(copy) <= search.initiatedDateTo)),
    )
    .sort(
      (a, b) =>
        direction * (timestamp(a.summary.createdDate) - timestamp(b.summary.createdDate)) ||
        a.id.localeCompare(b.id),
    );
}
export async function localRequisitions(search: RequisitionsQuery, timeZone: string) {
  const access = await readRequisitionAccess().catch((error: unknown) => {
    if (!(error instanceof LocalDataUnavailableError)) throw error;
    return undefined;
  });
  const copies = (await readCopies()).filter(
    (copy) => !access || mayViewCopy(access, copy.summary.facility.id, copy.summary.program.id),
  );
  return localPage(
    searchCopies(copies, search, timeZone).map((copy) => copy.summary),
    search.page,
    search.size,
  );
}
export async function localApprovals(search: ApprovalSearch) {
  if (!search.program) return localPage([], (search.page ?? 1) - 1, search.size ?? 20);
  const access = await readRequisitionAccess();
  const direction = search.dir === 'asc' ? 1 : -1;
  const copies = (await readCopies()).filter(
    (copy) =>
      copy.summary.program.id === search.program &&
      ['AUTHORIZED', 'IN_APPROVAL'].includes(copy.summary.status) &&
      mayApproveSavedCopy(access, copy),
  );
  copies.sort(
    (a, b) =>
      Number(b.summary.emergency) - Number(a.summary.emergency) ||
      direction *
        (timestamp(a.summary.statusChanges?.AUTHORIZED?.changeDate) -
          timestamp(b.summary.statusChanges?.AUTHORIZED?.changeDate)) ||
      a.id.localeCompare(b.id),
  );
  return localPage(
    copies.map((copy) => copy.summary),
    (search.page ?? 1) - 1,
    search.size ?? 20,
  );
}
