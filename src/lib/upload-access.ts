import { useLoginData } from '@/features/auth/store/login-data';
import { getConnectionGeneration } from '@/lib/online';
import { getSessionScope } from '@/lib/session-scope';

let sessionGeneration = 0;
useLoginData.subscribe((state, previous) => {
  if (
    state.accessToken !== previous.accessToken ||
    state.expired !== previous.expired ||
    state.referenceDataUserId !== previous.referenceDataUserId
  )
    sessionGeneration++;
});
export const uploadAccessEpoch = () =>
  `${getSessionScope()}:${sessionGeneration}:${getConnectionGeneration()}`;
