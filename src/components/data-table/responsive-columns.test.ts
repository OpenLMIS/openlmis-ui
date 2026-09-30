import type { ColumnVisibilityState } from '@tanstack/react-table';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  changedColumns,
  resolveColumnVisibility,
  useColumnVisibility,
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

describe('useColumnVisibility', () => {
  const render = (width: number) =>
    renderHook(() => {
      const stored = useState<ColumnVisibilityState>({});
      return { view: useColumnVisibility(columns, stored, width), choices: stored[0] };
    });

  it('stores only what the user toggled, on top of the earlier choices', () => {
    const { result } = render(phone);

    act(() =>
      result.current.view.onVisibilityChange({ ...result.current.view.visibility, email: true }),
    );
    act(() =>
      result.current.view.onVisibilityChange({ ...result.current.view.visibility, name: true }),
    );

    expect(result.current.choices).toEqual({ email: true, name: true });
    expect(result.current.view.visibility).toEqual({ username: true, name: true, email: true });
  });

  it('goes back to what fits the room on Reset Columns', () => {
    const { result } = render(phone);
    act(() =>
      result.current.view.onVisibilityChange({ ...result.current.view.visibility, email: true }),
    );

    act(() => result.current.view.onReset());

    expect(result.current.choices).toEqual({});
    expect(result.current.view.visibility).toEqual({ username: true, name: false, email: false });
  });
});
