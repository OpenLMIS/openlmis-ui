export const EMPTY_VALUE = '-';

export const orEmpty = <T>(value: T | null | undefined) =>
  value === null || value === undefined || value === '' ? EMPTY_VALUE : value;

export const tableValue = <T>(value: T | null | undefined) =>
  value === null || value === undefined || value === '' ? null : value;
