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
});
