import { useBlocker } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { isUnloadAllowed, type LeaveIntent, useLeaveGuard } from '@/hooks/use-leave-guard';

const dialogOf = (search: object) =>
  `${'item' in search ? search.item : ''}:${'edit' in search ? search.edit : ''}`;

export function useItemDialogGuard({
  dirty,
  pending,
  allowLeave,
}: {
  dirty: boolean;
  pending: boolean;
  allowLeave: () => boolean;
}) {
  const guarded = () => (dirty || pending) && !allowLeave();
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      guarded() &&
      next.pathname !== '/login' &&
      (current.pathname !== next.pathname || dialogOf(current.search) !== dialogOf(next.search)),
    enableBeforeUnload: () => guarded() && !isUnloadAllowed(),
    withResolver: true,
  });
  useEffect(() => {
    if (pending || allowLeave()) blocker.reset?.();
  }, [pending, allowLeave, blocker.reset]);
  const [pendingLeave, setPendingLeave] = useState<{
    proceed: () => void;
    intent: LeaveIntent;
  } | null>(null);
  const askToLeave = useCallback(
    (proceed: () => void, intent: LeaveIntent) => setPendingLeave({ proceed, intent }),
    [],
  );
  useLeaveGuard(guarded(), askToLeave);

  return {
    open: !pending && !allowLeave() && (blocker.status === 'blocked' || pendingLeave !== null),
    signingOut: pendingLeave?.intent === 'sign-out',
    onDiscard: () => {
      if (pending) return;
      if (pendingLeave) {
        setPendingLeave(null);
        pendingLeave.proceed();
      } else blocker.proceed?.();
    },
    onKeepEditing: () => {
      setPendingLeave(null);
      blocker.reset?.();
    },
  };
}
