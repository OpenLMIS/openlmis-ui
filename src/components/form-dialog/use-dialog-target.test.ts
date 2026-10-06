import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';

describe('useDialogTarget', () => {
  it('keeps showing the last target until the close animation ends', () => {
    const { result, rerender } = renderHook(({ target }) => useDialogTarget(target, vi.fn()), {
      initialProps: { target: 'ada' as string | undefined },
    });

    rerender({ target: undefined });
    expect(result.current.dialogProps().open).toBe(false);
    expect(result.current.shown).toBe('ada');

    act(() => result.current.dialogProps().onOpenChangeComplete(false));
    expect(result.current.shown).toBeUndefined();
  });

  it('asks to close unless locked', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDialogTarget('ada', onClose));

    result.current.dialogProps(true).onOpenChange(false);
    expect(onClose).not.toHaveBeenCalled();

    result.current.dialogProps(false).onOpenChange(false);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes once, at the first ask, while the page is still catching up', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDialogTarget('ada', onClose));

    act(() => result.current.dialogProps().onOpenChange(false));
    act(() => result.current.dialogProps().onOpenChange(false));
    act(() => result.current.close());

    expect(onClose).toHaveBeenCalledOnce();
    expect(result.current.dialogProps().open).toBe(false);
  });

  it('opens again for the next target after a close', () => {
    const { result, rerender } = renderHook(({ target }) => useDialogTarget(target, vi.fn()), {
      initialProps: { target: 'ada' as string | undefined },
    });

    act(() => result.current.close());
    rerender({ target: undefined });
    rerender({ target: 'ada' });

    expect(result.current.dialogProps().open).toBe(true);
  });

  it('closes once when asked twice in the same event', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDialogTarget('ada', onClose));

    act(() => {
      result.current.close();
      result.current.dialogProps().onOpenChange(false);
    });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
