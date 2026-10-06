import { describe, expect, it } from 'vitest';
import {
  showsInactive,
  stockOnHandSearchSchema,
  toSummariesQuery,
} from '@/features/stock-on-hand/lib/search';

const FACILITY = 'e6799d64-d10d-4011-b8c2-0e4d4a3f65ce';
const PROGRAM = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';

describe('stockOnHandSearchSchema', () => {
  it('keeps the picker, filters and page', () => {
    expect(
      stockOnHandSearchSchema.parse({
        mode: 'supervised',
        facilityId: FACILITY,
        programId: PROGRAM,
        productCode: 'C1',
        productName: 'Levo',
        lotCode: 'L-1',
        includeInactive: false,
        page: 2,
        size: 20,
      }),
    ).toEqual({
      mode: 'supervised',
      facilityId: FACILITY,
      programId: PROGRAM,
      productCode: 'C1',
      productName: 'Levo',
      lotCode: 'L-1',
      includeInactive: false,
      page: 2,
      size: 20,
    });
  });

  it('drops what is not valid, and has no sort', () => {
    expect(
      stockOnHandSearchSchema.parse({ includeInactive: 'maybe', page: 0, sort: 'code' }),
    ).toEqual({});
  });
});

describe('showsInactive', () => {
  it('shows inactive cards unless turned off, as legacy does with no choice made', () => {
    expect(showsInactive({})).toBe(true);
    expect(showsInactive({ includeInactive: true })).toBe(true);
    expect(showsInactive({ includeInactive: false })).toBe(false);
  });
});

describe('toSummariesQuery', () => {
  it('asks for one zero-based page of products with stock cards, for the facility and program', () => {
    expect(
      toSummariesQuery({ page: 3, size: 20 }, { facilityId: FACILITY, programId: PROGRAM }),
    ).toEqual({
      facilityId: FACILITY,
      programId: PROGRAM,
      nonEmptyOnly: true,
      page: 2,
      size: 20,
    });
  });

  it('sends the product and lot filters under the names the server reads', () => {
    expect(
      toSummariesQuery(
        { productCode: 'C1', productName: 'Levo', lotCode: 'L-1', includeInactive: false },
        { facilityId: FACILITY, programId: PROGRAM },
      ),
    ).toEqual({
      facilityId: FACILITY,
      programId: PROGRAM,
      nonEmptyOnly: true,
      page: 0,
      size: 10,
      orderableCode: 'C1',
      orderableName: 'Levo',
      lotCode: 'L-1',
    });
  });

  it('trims the filters', () => {
    expect(
      toSummariesQuery({ productCode: ' C1 ' }, { facilityId: FACILITY, programId: PROGRAM }),
    ).toMatchObject({ orderableCode: 'C1' });
  });
});
