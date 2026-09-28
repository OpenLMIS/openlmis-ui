import { useBlocker } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { useLeaveGuard } from '@/hooks/use-leave-guard';

type DiscardGuardOptions = {
  /** True once the page may be left without asking, e.g. right after a save. */
  allowLeave?: () => boolean;
};

/** While there are unsaved changes, leaving the page or signing out asks first; the dialog's props. */
export function useDiscardGuard(changes: number, { allowLeave }: DiscardGuardOptions = {}) {
  // Opening a dialog keeps the page, so only a different page, or tab, can lose the draft.
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      !allowLeave?.() &&
      changes > 0 &&
      current.pathname !== next.pathname &&
      next.pathname !== '/login',
    enableBeforeUnload: () => changes > 0,
    withResolver: true,
  });
  // A sign out waiting on the dialog; signing out leaves without the router.
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const askToLeave = useCallback((proceed: () => void) => setPendingLeave(() => proceed), []);
  useLeaveGuard(changes > 0, askToLeave);

  const leaveIfAsked = () => {
    if (!pendingLeave) return false;
    setPendingLeave(null);
    pendingLeave();
    return true;
  };

  return {
    open: blocker.status === 'blocked' || pendingLeave !== null,
    signingOut: pendingLeave !== null,
    /** Runs a sign out that is waiting on the dialog, e.g. once a save kept the changes. */
    leaveIfAsked,
    onDiscard: () => {
      if (!leaveIfAsked()) blocker.proceed?.();
    },
    onKeepEditing: () => {
      setPendingLeave(null);
      blocker.reset?.();
    },
  };
}
