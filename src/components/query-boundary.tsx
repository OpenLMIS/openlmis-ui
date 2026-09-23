import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { CatchBoundary, type ErrorRouteComponent } from '@tanstack/react-router';
import { type ReactNode, Suspense } from 'react';

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
  errorComponent,
  children,
}: QueryBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    // Resetting on catch lets the failed query refetch once the boundary renders children again.
    <CatchBoundary errorComponent={errorComponent} getResetKey={() => resetKey} onCatch={reset}>
      <Suspense fallback={pendingFallback}>{children}</Suspense>
    </CatchBoundary>
  );
}
