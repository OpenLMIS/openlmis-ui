import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLeaveGuard, whenLeaveAllowed } from '@/hooks/use-leave-guard';

describe('useLeaveGuard', () => {
  it('lets a leave through at once when no page guards it', () => {
    const proceed = vi.fn();
    whenLeaveAllowed(proceed);
    expect(proceed).toHaveBeenCalledOnce();
  });

  it('asks the guarding page instead, which decides whether to proceed', () => {
    const ask = vi.fn();
    const { rerender, unmount } = renderHook(({ active }) => useLeaveGuard(active, ask), {
      initialProps: { active: true },
    });
    const proceed = vi.fn();

    whenLeaveAllowed(proceed);
    expect(ask).toHaveBeenCalledWith(proceed);
    expect(proceed).not.toHaveBeenCalled();

    rerender({ active: false });
    whenLeaveAllowed(proceed);
    expect(proceed).toHaveBeenCalledOnce();
    unmount();
  });

  it('keeps asking while another guarded page still has changes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const a = renderHook(({ active }) => useLeaveGuard(active, first), {
      initialProps: { active: true },
    });
    const b = renderHook(({ active }) => useLeaveGuard(active, second), {
      initialProps: { active: true },
    });
    const proceed = vi.fn();

    b.rerender({ active: false });
    whenLeaveAllowed(proceed);
    expect(first).toHaveBeenCalledWith(proceed);
    expect(proceed).not.toHaveBeenCalled();

    a.unmount();
    b.unmount();
  });
});
