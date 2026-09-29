import type { ErrorInfo } from 'react';
import { isOfflineError } from '@/lib/http';

export function reportCaughtError(error: unknown, { componentStack }: ErrorInfo) {
  if (isOfflineError(error)) return;
  console.error(error, componentStack);
}
