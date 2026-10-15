import { useLoginData } from '@/features/auth/store/login-data';
import type { OfflineAccess } from '@/lib/offline-access';
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
let refresh: ((force?: boolean) => Promise<OfflineAccess>) | undefined;
export function setUploadAccessReader(reader?: (force?: boolean) => Promise<OfflineAccess>) {
  refresh = reader;
}
export function freshUploadAccess(force = false) {
  if (!refresh) return Promise.reject(new Error('Fresh sync access is unavailable.'));
  return refresh(force);
}
