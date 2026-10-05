import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOpening } from '@/hooks/use-opening';

describe('useOpening', () => {
  it('keeps one number for the life of a component, and gives the next one a new number', () => {
    const first = renderHook(() => useOpening());
    const opening = first.result.current;
    first.rerender();
    expect(first.result.current).toBe(opening);

    const second = renderHook(() => useOpening());
    expect(second.result.current).not.toBe(opening);
  });
});
