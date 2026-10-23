import { useLoginData } from '@/features/auth/store/login-data';

export function onSessionResumed({
  onUserChange,
  onExpired,
  onResume,
}: {
  onUserChange: () => void;
  onExpired: () => void;
  onResume: (fromExpiry: boolean) => void;
}) {
  return useLoginData.subscribe((state, previous) => {
    const changedUser = state.referenceDataUserId !== previous.referenceDataUserId;
    if (changedUser) onUserChange();
    if (state.expired) onExpired();
    if (
      state.isAuthenticated &&
      !state.expired &&
      (changedUser || previous.expired || state.accessToken !== previous.accessToken)
    )
      onResume(previous.expired && !changedUser);
  });
}
