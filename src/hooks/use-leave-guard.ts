import { useEffect } from 'react';

/** Asks the user, then calls `proceed` only if they agree to lose their changes. */
type AskToLeave = (proceed: () => void) => void;

let askToLeave: AskToLeave | null = null;

/** Runs `proceed` at once, or after the page with unsaved changes has asked and the user agreed. */
export function whenLeaveAllowed(proceed: () => void) {
  if (askToLeave) askToLeave(proceed);
  else proceed();
}

/** While `active`, leaving by a way the router cannot block, such as signing out, asks first. */
export function useLeaveGuard(active: boolean, ask: AskToLeave) {
  useEffect(() => {
    if (!active) return;
    askToLeave = ask;
    return () => {
      if (askToLeave === ask) askToLeave = null;
    };
  }, [active, ask]);
}
