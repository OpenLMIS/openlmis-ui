import { describe, expect, it } from 'vitest';
import {
  assignmentsSearchSchema,
  hasAssignmentFilters,
  isHalfFiltered,
  toAssignmentsQuery,
} from '@/components/valid-assignments/search';

const FACILITY = '13037147-1769-4735-90a7-b9b310d128b8';
const PROGRAM = 'dce17f2e-af3e-40ad-8e00-3496adef44c3';

describe('assignmentsSearchSchema', () => {
  it('keeps a facility and a program given as ids', () => {
    expect(assignmentsSearchSchema.parse({ facilityId: FACILITY, programId: PROGRAM })).toEqual({
      facilityId: FACILITY,
      programId: PROGRAM,
    });
  });

  it('drops values that are not ids rather than failing the page', () => {
    expect(
      assignmentsSearchSchema.parse({ facilityId: 'x', programId: 7, assignment: 'old' }),
    ).toEqual({});
  });

  it('opens the add dialog with assignment=new', () => {
    expect(assignmentsSearchSchema.parse({ assignment: 'new' })).toEqual({ assignment: 'new' });
  });
});

describe('toAssignmentsQuery', () => {
  it('asks for the first page in a fixed order, so pages never repeat a row', () => {
    expect(toAssignmentsQuery({})).toEqual({
      page: 0,
      size: 10,
      sort: ['programId,asc', 'facilityTypeId,asc', 'id,asc'],
    });
  });

  it('sends the facility and the program together', () => {
    expect(toAssignmentsQuery({ facilityId: FACILITY, programId: PROGRAM, page: 2 })).toEqual({
      page: 1,
      size: 10,
      sort: ['programId,asc', 'facilityTypeId,asc', 'id,asc'],
      facilityId: FACILITY,
      programId: PROGRAM,
    });
  });

  it('sends neither when only one is picked, since the server refuses one alone', () => {
    expect(toAssignmentsQuery({ facilityId: FACILITY })).not.toHaveProperty('facilityId');
    expect(toAssignmentsQuery({ programId: PROGRAM })).not.toHaveProperty('programId');
  });
});

describe('filters', () => {
  it('counts either pick as a filter', () => {
    expect(hasAssignmentFilters({})).toBe(false);
    expect(hasAssignmentFilters({ programId: PROGRAM })).toBe(true);
  });

  it('is half filtered with exactly one of the pair', () => {
    expect(isHalfFiltered({})).toBe(false);
    expect(isHalfFiltered({ facilityId: FACILITY })).toBe(true);
    expect(isHalfFiltered({ programId: PROGRAM })).toBe(true);
    expect(isHalfFiltered({ facilityId: FACILITY, programId: PROGRAM })).toBe(false);
  });
});
