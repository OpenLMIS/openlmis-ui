import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';

describe('useMenuOpensDialog', () => {
  it('gives focus back to the trigger when the menu just closes', () => {
    const { result } = renderHook(() => useMenuOpensDialog());

    act(() => result.current.onOpenChange(true));
    expect(result.current.finalFocus()).toBe(true);
  });

  it('leaves focus to a dialog an item opened', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useMenuOpensDialog());

    act(() => result.current.onOpenChange(true));
    act(() => result.current.opensDialog(open)());
    expect(open).toHaveBeenCalledOnce();
    expect(result.current.finalFocus()).toBe(false);
  });

  it('forgets the dialog once the menu opens again', () => {
    const { result } = renderHook(() => useMenuOpensDialog());

    act(() => result.current.opensDialog(() => {})());
    act(() => result.current.onOpenChange(true));
    expect(result.current.finalFocus()).toBe(true);
  });
});
