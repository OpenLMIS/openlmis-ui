import type { ErrorInfo } from 'react';
import { isOfflineError } from '@/lib/http';

/** React's report of a caught error; a request with no answer is explained on the page. */
export function reportCaughtError(error: unknown, { componentStack }: ErrorInfo) {
  if (isOfflineError(error)) return;
  console.error(error, componentStack);
}
