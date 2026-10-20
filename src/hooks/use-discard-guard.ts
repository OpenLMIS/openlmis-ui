import { useBlocker } from '@tanstack/react-router';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { isUnloadAllowed, useLeaveGuard } from '@/hooks/use-leave-guard';

type DiscardGuardOptions = {
  /** True once the page may be left without asking, e.g. right after a save. */
  allowLeave?: () => boolean;
  pending?: boolean;
  flushBeforeLeave?: () => Promise<boolean>;
};

/** While there are unsaved changes, leaving the page or signing out asks first; the dialog's props. */
export function useDiscardGuard(
  dirty: boolean,
  { allowLeave, pending = false, flushBeforeLeave }: DiscardGuardOptions = {},
) {
  // Opening a dialog keeps the page, so only a different page, or tab, can lose the draft.
  const blocker = useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      if (allowLeave?.() || current.pathname === next.pathname || next.pathname === '/login')
        return false;
      if (pending) return true;
      if (flushBeforeLeave) return !(await flushBeforeLeave());
      return dirty;
    },
    enableBeforeUnload: () => dirty && !allowLeave?.() && !isUnloadAllowed(),
    withResolver: true,
  });
  useEffect(() => {
    if (pending || allowLeave?.()) blocker.reset?.();
  }, [pending, allowLeave, blocker.reset]);
  // A sign out waiting on the dialog; signing out leaves without the router.
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [flushingLeave, setFlushingLeave] = useState(false);
  const flushLeave = useEffectEvent(async (proceed: () => void) => {
    setFlushingLeave(true);
    try {
      if (await flushBeforeLeave?.()) {
        setPendingLeave(null);
        proceed();
      }
    } finally {
      setFlushingLeave(false);
    }
  });
  const deviceDraft = !!flushBeforeLeave;
  const askToLeave = useCallback(
    (proceed: () => void) => {
      setFlushingLeave(deviceDraft);
      setPendingLeave(() => proceed);
    },
    [deviceDraft],
  );
  useLeaveGuard(!allowLeave?.() && (dirty || deviceDraft), askToLeave);
  useEffect(() => {
    if (deviceDraft && pendingLeave && !pending) void flushLeave(pendingLeave);
  }, [deviceDraft, pendingLeave, pending]);

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
      open:
        !pending &&
        !flushingLeave &&
        !allowLeave?.() &&
        (blocker.status === 'blocked' || pendingLeave !== null),
      signingOut: pendingLeave !== null,
      onDiscard: () => {
        if (pending) return;
        if (!leaveIfAsked()) blocker.proceed?.();
      },
      onKeepEditing: () => {
        setPendingLeave(null);
        blocker.reset?.();
      },
    },
  };
}
