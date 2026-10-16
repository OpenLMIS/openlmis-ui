import { useEffect, useState } from 'react';
import { useLoginData } from '@/features/auth/store/login-data';
import { useOnline } from '@/lib/online';

export function useOfflineSession() {
  const online = useOnline();
  const expired = useLoginData((state) => state.expired);
  const expiresAt = useLoginData((state) => state.expiresAt);
  const authenticated = useLoginData((state) => state.isAuthenticated);
  const [, tick] = useState(0);
  const warningAt = expiresAt === null ? null : expiresAt - 60_000;
  useEffect(() => {
    if (online || warningAt === null || warningAt <= Date.now()) return;
    const timer = setTimeout(
      () => tick((value) => value + 1),
      Math.min(warningAt - Date.now(), 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [online, warningAt]);
  return authenticated && (expired || (!online && warningAt !== null && warningAt <= Date.now()));
}
