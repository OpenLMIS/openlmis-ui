import { useEffect } from 'react';

/** Asks the user, then calls `proceed` only if they agree to lose their changes. */
type AskToLeave = (proceed: () => void) => void;

// Newest last, so the page registered most recently asks; one leaving takes its guard with it.
const guards: AskToLeave[] = [];

/** Runs `proceed` at once, or after the page with unsaved changes has asked and the user agreed. */
export function whenLeaveAllowed(proceed: () => void) {
  const ask = guards.at(-1);
  if (ask) ask(proceed);
  else proceed();
}

/** While `active`, leaving by a way the router cannot block, such as signing out, asks first. */
export function useLeaveGuard(active: boolean, ask: AskToLeave) {
  useEffect(() => {
    if (!active) return;
    guards.push(ask);
    return () => {
      const index = guards.lastIndexOf(ask);
      if (index !== -1) guards.splice(index, 1);
    };
  }, [active, ask]);
}
