import { describe, expect, it } from 'vitest';
import {
  changedColumns,
  resolveColumnVisibility,
} from '@/components/data-table/responsive-columns';

const columns = [
  { id: 'username' },
  { id: 'name', hideBelow: 'xl' },
  { id: 'email', hideBelow: '4xl' },
] as const;

const phone = 358;
const desktop = 1136;

describe('resolveColumnVisibility', () => {
  it('hides columns there is no room for', () => {
    expect(resolveColumnVisibility(columns, {}, phone)).toEqual({
      username: true,
      name: false,
      email: false,
    });
    expect(resolveColumnVisibility(columns, {}, 700)).toEqual({
      username: true,
      name: true,
      email: false,
    });
    expect(resolveColumnVisibility(columns, {}, desktop)).toEqual({
      username: true,
      name: true,
      email: true,
    });
  });

  it('shows everything before the width is known', () => {
    expect(resolveColumnVisibility(columns, {}, undefined)).toMatchObject({ email: true });
  });

  it('lets the user override the default either way', () => {
    expect(resolveColumnVisibility(columns, { name: true }, phone)).toMatchObject({ name: true });
    expect(resolveColumnVisibility(columns, { email: false }, desktop)).toMatchObject({
      email: false,
    });
  });
});

describe('changedColumns', () => {
  it('keeps only the columns that were toggled', () => {
    const showing = { username: true, name: false, email: false };

    expect(changedColumns(showing, { ...showing, name: true })).toEqual({ name: true });
  });
});
