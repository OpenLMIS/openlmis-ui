import { isOfflineError } from '@/lib/http';
import { isOnline } from '@/lib/online';

/** React's report of an error a boundary caught; offline failures are explained on the page. */
export function reportCaughtError(error: unknown) {
  if (isOfflineError(error) || !isOnline()) return;
  console.error(error);
}
