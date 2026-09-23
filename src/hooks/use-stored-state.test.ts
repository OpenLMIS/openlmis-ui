import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useStoredState } from '@/hooks/use-stored-state';

const schema = z.object({ email: z.boolean() });

beforeEach(() => {
  localStorage.clear();
});

describe('useStoredState', () => {
  it('starts from the initial value and keeps what is set', () => {
    const { result } = renderHook(() => useStoredState('prefs', schema, { email: true }));
    expect(result.current[0]).toEqual({ email: true });

    act(() => result.current[1]({ email: false }));

    expect(result.current[0]).toEqual({ email: false });
    expect(JSON.parse(localStorage.getItem('prefs') ?? '')).toEqual({ email: false });
  });

  it('restores a stored value', () => {
    localStorage.setItem('prefs', JSON.stringify({ email: false }));
    const { result } = renderHook(() => useStoredState('prefs', schema, { email: true }));

    expect(result.current[0]).toEqual({ email: false });
  });

  it('ignores a stored value of the wrong shape', () => {
    localStorage.setItem('prefs', 'null');
    const { result } = renderHook(() => useStoredState('prefs', schema, { email: true }));

    expect(result.current[0]).toEqual({ email: true });
  });

  it('ignores a stored value it cannot read', () => {
    localStorage.setItem('prefs', '{not json');
    const { result } = renderHook(() => useStoredState('prefs', schema, { email: true }));

    expect(result.current[0]).toEqual({ email: true });
  });
});
