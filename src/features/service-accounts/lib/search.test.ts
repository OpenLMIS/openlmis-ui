import { describe, expect, it } from 'vitest';
import {
  serviceAccountsSearchSchema,
  toServiceAccountsQuery,
} from '@/features/service-accounts/lib/search';

describe('serviceAccountsSearchSchema', () => {
  it('keeps valid params and drops invalid ones', () => {
    expect(serviceAccountsSearchSchema.parse({ page: 2, dir: 'asc', add: true })).toEqual({
      page: 2,
      dir: 'asc',
      add: true,
    });
    expect(serviceAccountsSearchSchema.parse({ page: 0, sort: 'token', add: 'yes' })).toEqual({});
  });

  it('opens the delete dialog for a key', () => {
    const token = '9a556033-ed13-4dde-9561-158469d15134';
    expect(serviceAccountsSearchSchema.parse({ delete: token })).toEqual({ delete: token });
    expect(serviceAccountsSearchSchema.parse({ delete: 'nope' })).toEqual({});
  });
});

describe('toServiceAccountsQuery', () => {
  it('asks for the newest keys first by default, zero-based', () => {
    expect(toServiceAccountsQuery({})).toEqual({
      page: 0,
      size: 10,
      sort: 'creationDetails.createdDate,desc',
    });
  });

  it('maps the date sort to the field the server sorts on', () => {
    expect(toServiceAccountsQuery({ page: 3, size: 20, dir: 'asc' })).toEqual({
      page: 2,
      size: 20,
      sort: 'creationDetails.createdDate,asc',
    });
  });
});
