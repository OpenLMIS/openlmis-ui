import { describe, expect, it } from 'vitest';
import {
  changedColumns,
  resolveColumnVisibility,
} from '@/components/data-table/responsive-columns';

const columns = [
  { id: 'username' },
  { id: 'name', hideBelow: 'sm' },
  { id: 'email', hideBelow: 'lg' },
] as const;

const phone = { sm: false, md: false, lg: false, xl: false };
const desktop = { sm: true, md: true, lg: true, xl: true };

describe('resolveColumnVisibility', () => {
  it('hides columns the screen is too narrow for', () => {
    expect(resolveColumnVisibility(columns, {}, phone)).toEqual({
      username: true,
      name: false,
      email: false,
    });
    expect(resolveColumnVisibility(columns, {}, desktop)).toEqual({
      username: true,
      name: true,
      email: true,
    });
  });

  it('lets the user override the screen either way', () => {
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
