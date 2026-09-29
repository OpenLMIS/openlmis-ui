import { useBlocker } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { isUnloadAllowed, useLeaveGuard } from '@/hooks/use-leave-guard';

type DiscardGuardOptions = {
  /** True once the page may be left without asking, e.g. right after a save. */
  allowLeave?: () => boolean;
};

/** While there are unsaved changes, leaving the page or signing out asks first; the dialog's props. */
export function useDiscardGuard(dirty: boolean, { allowLeave }: DiscardGuardOptions = {}) {
  // Opening a dialog keeps the page, so only a different page, or tab, can lose the draft.
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      !allowLeave?.() && dirty && current.pathname !== next.pathname && next.pathname !== '/login',
    enableBeforeUnload: () => dirty && !isUnloadAllowed(),
    withResolver: true,
  });
  // A sign out waiting on the dialog; signing out leaves without the router.
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const askToLeave = useCallback((proceed: () => void) => setPendingLeave(() => proceed), []);
  useLeaveGuard(dirty, askToLeave);

  const leaveIfAsked = () => {
    if (!pendingLeave) return false;
    setPendingLeave(null);
    pendingLeave();
    return true;
  };

  return {
    /** Runs a sign out that is waiting on the dialog, e.g. once a save kept the changes. */
    leaveIfAsked,
    /** The props for `DiscardChangesDialog`. */
    dialog: {
      open: blocker.status === 'blocked' || pendingLeave !== null,
      signingOut: pendingLeave !== null,
      onDiscard: () => {
        if (!leaveIfAsked()) blocker.proceed?.();
      },
      onKeepEditing: () => {
        setPendingLeave(null);
        blocker.reset?.();
      },
    },
  };
}
