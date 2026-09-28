import type { QueryClient } from '@tanstack/react-query';
import { rightsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { isRefused } from '@/lib/http';

/** Thrown by a route whose user lacks the right the page needs. */
export class ForbiddenError extends Error {
  constructor(right: string) {
    super(`Missing right ${right}`);
    this.name = 'ForbiddenError';
  }
}

/** A missing right, found by the page up front or refused by the server. */
export function isForbidden(error: unknown) {
  return error instanceof ForbiddenError || isRefused(error);
}

/** For a loader: resolves with the signed-in user's rights once they include `right`, throws otherwise. */
export async function requireRight(queryClient: QueryClient, right: string) {
  const userId = useLoginData.getState().referenceDataUserId;
  // Refetched once stale or invalidated, e.g. after saving your own roles, so a lost right counts.
  const rights = userId ? await queryClient.fetchQuery(rightsOptions(userId)) : new Set<string>();
  if (!rights.has(right)) throw new ForbiddenError(right);
  return rights;
}
