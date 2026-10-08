import { describe, expect, it } from 'vitest';
import {
  changeDetailPaging,
  detailPagingSchema,
  detailTableSearch,
  hasEventFilters,
  invalidDateRange,
  toEventsQuery,
  transactionHistorySearchSchema,
} from '@/features/stock-events/lib/search';

const FACILITY = '11111111-1111-4111-8111-111111111111';
const PROGRAM = '22222222-2222-4222-8222-222222222222';
const selection = { facilityId: FACILITY, programId: PROGRAM };

describe('transaction history search', () => {
  it('keeps valid filters and drops invalid ones to their defaults', () => {
    expect(
      transactionHistorySearchSchema.parse({
        mode: 'my',
        programId: PROGRAM,
        facilityId: FACILITY,
        type: 'issue',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        documentNumber: 'DOC',
        page: 2,
        sort: 'date',
      }),
    ).toEqual({
      mode: 'my',
      programId: PROGRAM,
      facilityId: FACILITY,
      type: 'issue',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      documentNumber: 'DOC',
      page: 2,
    });
    expect(
      transactionHistorySearchSchema.parse({
        type: 'physicalInventory',
        startDate: '2026-02-30',
        endDate: 'tomorrow',
        documentNumber: '  ',
      }),
    ).toEqual({});
  });

  it('flags an end date before the start date only', () => {
    expect(invalidDateRange({ startDate: '2026-01-02', endDate: '2026-01-01' })).toBe(true);
    expect(invalidDateRange({ startDate: '2026-01-01', endDate: '2026-01-01' })).toBe(false);
    expect(invalidDateRange({ startDate: '2026-01-02' })).toBe(false);
    expect(invalidDateRange({ endDate: '2026-01-01' })).toBe(false);
  });

  it('counts the filters a user set', () => {
    expect(hasEventFilters({})).toBe(false);
    expect(hasEventFilters({ type: 'receive' })).toBe(true);
    expect(hasEventFilters({ documentNumber: 'A' })).toBe(true);
  });

  it('sends the filters as legacy does, the document number as typed, with a zero-based page', () => {
    expect(toEventsQuery({}, selection)).toEqual({ ...selection, page: 0, size: 20 });
    expect(
      toEventsQuery(
        {
          type: 'adjustment',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          documentNumber: ' DOC-1 ',
          page: 3,
          size: 20,
        },
        selection,
      ),
    ).toEqual({
      ...selection,
      type: 'adjustment',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      documentNumber: ' DOC-1 ',
      page: 2,
      size: 20,
    });
  });
});

describe('detail paging search', () => {
  it('validates detail paging apart from the list paging', () => {
    expect(detailPagingSchema.parse({ detailPage: 2, detailSize: 50, page: 4 })).toEqual({
      detailPage: 2,
      detailSize: 50,
    });
    expect(detailPagingSchema.parse({ detailPage: 0, detailSize: 7 })).toEqual({
      detailPage: undefined,
      detailSize: undefined,
    });
  });

  it('maps detail paging onto table state and back', () => {
    expect(detailTableSearch({ detailPage: 2, detailSize: 20 })).toEqual({ page: 2, size: 20 });
    expect(changeDetailPaging({ detailPage: 2, detailSize: 20 }, () => ({ page: 3 }))).toEqual({
      detailPage: 3,
      detailSize: 20,
    });
  });
});
