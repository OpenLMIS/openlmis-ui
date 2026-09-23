import { describe, expect, it, vi } from 'vitest';
import {
  fromPaginationState,
  fromSortingState,
  type TableSearch,
  tableSearchSchema,
  tableSearchState,
  toPaginationState,
  toSortingState,
  toSortParam,
} from '@/lib/table-search';

const defaultSort = { id: 'username', desc: false };

describe('tableSearchSchema', () => {
  const schema = tableSearchSchema(['username', 'lastName']);

  it('keeps valid params', () => {
    expect(schema.parse({ page: 3, size: 20, sort: 'lastName', dir: 'desc' })).toEqual({
      page: 3,
      size: 20,
      sort: 'lastName',
      dir: 'desc',
    });
  });

  it('drops invalid params instead of failing the route', () => {
    expect(schema.parse({ page: 0, size: 7, sort: 'password', dir: 'up' })).toEqual({});
  });
});

describe('pagination mapping', () => {
  it('reads a missing page and size as the first page of the default size', () => {
    expect(toPaginationState({})).toEqual({ pageIndex: 0, pageSize: 10 });
  });

  it('writes defaults as absent params', () => {
    expect(
      fromPaginationState({ pageIndex: 1, pageSize: 10 }, { pageIndex: 0, pageSize: 10 }),
    ).toEqual({ page: undefined, size: undefined });
  });

  it('returns to the first page when the page size changes', () => {
    expect(
      fromPaginationState({ pageIndex: 4, pageSize: 10 }, { pageIndex: 2, pageSize: 50 }),
    ).toEqual({ page: undefined, size: 50 });
  });
});

describe('sorting mapping', () => {
  it('falls back to the default sort', () => {
    expect(toSortingState({}, defaultSort)).toEqual([{ id: 'username', desc: false }]);
    expect(toSortParam({}, defaultSort)).toBe('username,asc');
  });

  it('writes the default sort as absent params', () => {
    expect(fromSortingState([{ id: 'username', desc: false }], defaultSort)).toEqual({
      sort: undefined,
      dir: undefined,
    });
    expect(fromSortingState([{ id: 'lastName', desc: true }], defaultSort)).toEqual({
      sort: 'lastName',
      dir: 'desc',
    });
  });
});

describe('tableSearchState', () => {
  it('builds each change on the latest search rather than the rendered one', () => {
    const onSearchChange = vi.fn();
    const { onPaginationChange } = tableSearchState<TableSearch>({
      search: { page: 1 },
      defaultSort,
      onSearchChange,
    });

    onPaginationChange((old) => ({ ...old, pageIndex: old.pageIndex + 1 }));
    const update = onSearchChange.mock.calls[0]?.[0];

    expect(update({ page: 5 })).toEqual({ page: 6, size: undefined });
  });

  it('returns to the first page when the sort changes', () => {
    const onSearchChange = vi.fn();
    const { onSortingChange } = tableSearchState<TableSearch>({
      search: { page: 3 },
      defaultSort,
      onSearchChange,
    });

    onSortingChange([{ id: 'lastName', desc: false }]);
    const update = onSearchChange.mock.calls[0]?.[0];

    expect(update({ page: 3 })).toEqual({ sort: 'lastName', dir: 'asc', page: undefined });
  });
});
