import { useBlocker } from '@tanstack/react-router';
import { type RefObject, useEffect } from 'react';

export function useAssociationDiscardGuard(
  dirty: boolean,
  pending: boolean,
  allowClose: RefObject<boolean>,
) {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      !allowClose.current &&
      (dirty || pending) &&
      current.pathname === next.pathname &&
      (current.search as Record<string, unknown>).association !==
        (next.search as Record<string, unknown>).association,
    enableBeforeUnload: false,
    withResolver: true,
  });
  useEffect(() => {
    if (pending && blocker.status === 'blocked') blocker.reset?.();
  }, [pending, blocker.status, blocker.reset]);
  return {
    open: !pending && blocker.status === 'blocked',
    signingOut: false,
    onDiscard: () => {
      if (!pending) blocker.proceed?.();
    },
    onKeepEditing: () => blocker.reset?.(),
  };
}
