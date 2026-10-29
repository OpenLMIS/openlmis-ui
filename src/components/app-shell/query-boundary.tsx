import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import {
  CatchBoundary,
  type ErrorComponentProps,
  type ErrorRouteComponent,
} from '@tanstack/react-router';
import { type ReactNode, Suspense, useCallback } from 'react';

type QueryBoundaryProps = {
  /** A change clears a caught error, e.g. new filters after a failed request. */
  resetKey: unknown;
  pendingFallback: ReactNode;
  errorComponent: ErrorRouteComponent;
  children: ReactNode;
};

/** Suspense plus an error boundary for a subtree that reads `useSuspenseQuery`. */
export function QueryBoundary({
  resetKey,
  pendingFallback,
  errorComponent: ErrorComponent,
  children,
}: QueryBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();

  const RenderError = useCallback(
    (props: ErrorComponentProps) => (
      <ErrorComponent
        {...props}
        reset={() => {
          reset();
          props.reset();
        }}
      />
    ),
    [ErrorComponent, reset],
  );
  return (
    // Reset again on retry: another reader of the same query may have cleared the reset on catch.
    <CatchBoundary errorComponent={RenderError} getResetKey={() => resetKey} onCatch={reset}>
      <Suspense fallback={pendingFallback}>{children}</Suspense>
    </CatchBoundary>
  );
}
