import { useBlocker } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { isUnloadAllowed, useLeaveGuard } from '@/hooks/use-leave-guard';

export function useDialogDiscardGuard({
  dirty,
  pending,
  active,
  targetKey,
  allowLeave,
}: {
  dirty: boolean;
  pending: boolean;
  active: boolean;
  targetKey: 'category' | 'reason';
  allowLeave: () => boolean;
}) {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      active &&
      !allowLeave() &&
      (dirty || pending) &&
      next.pathname !== '/login' &&
      (current.pathname !== next.pathname ||
        (current.search as Record<string, unknown>)[targetKey] !==
          (next.search as Record<string, unknown>)[targetKey]),
    enableBeforeUnload: () => active && (dirty || pending) && !allowLeave() && !isUnloadAllowed(),
    withResolver: true,
  });
  useEffect(() => {
    if (pending || !active || allowLeave()) blocker.reset?.();
  }, [pending, active, allowLeave, blocker.reset]);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const askToLeave = useCallback((proceed: () => void) => setPendingLeave(() => proceed), []);
  useLeaveGuard(active && (dirty || pending) && !allowLeave(), askToLeave);

  return {
    open:
      active &&
      !pending &&
      !allowLeave() &&
      (blocker.status === 'blocked' || pendingLeave !== null),
    signingOut: pendingLeave !== null,
    onDiscard: () => {
      if (pending) return;
      if (pendingLeave) {
        setPendingLeave(null);
        pendingLeave();
      } else blocker.proceed?.();
    },
    onKeepEditing: () => {
      setPendingLeave(null);
      blocker.reset?.();
    },
  };
}
