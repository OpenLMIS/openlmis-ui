import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useLoginData } from '@/features/auth/store/login-data';

export function useReloadForUser(loadedUserId: string | undefined | null, queryKey: QueryKey) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useLoginData((state) => state.referenceDataUserId);
  const previousUser = useRef(userId);
  const key = JSON.stringify(queryKey);
  useEffect(() => {
    const changed = previousUser.current !== userId;
    previousUser.current = userId;
    if (userId && (changed || loadedUserId !== userId)) {
      queryClient.removeQueries({ queryKey: JSON.parse(key) as QueryKey });
      void router.invalidate();
    }
  }, [userId, loadedUserId, queryClient, router, key]);
  return userId;
}
