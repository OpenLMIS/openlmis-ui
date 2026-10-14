import { fetchPermissionStrings } from '@/features/auth/api/api';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchFacility,
  fetchUserPrograms,
  fetchUserRecord,
} from '@/features/reference-data/api/api';
import { type AccessReaders, bootstrapOfflineAccess } from '@/lib/offline-access';

const readers: AccessReaders = {
  permissions: (id) => fetchPermissionStrings(id, { session: false }),
  user: (id) => fetchUserRecord(id, { session: false }),
  programs: (id) => fetchUserPrograms(id, { session: false }),
  home: (id) => fetchFacility(id, { session: false }),
};

export function startOfflineCoordinator() {
  const refresh = () => {
    void bootstrapOfflineAccess(readers).catch(() => undefined);
  };
  const unsubscribe = useLoginData.subscribe((state, previous) => {
    if (!state.isAuthenticated || state.expired) return;
    if (
      state.referenceDataUserId !== previous.referenceDataUserId ||
      state.accessToken !== previous.accessToken ||
      previous.expired
    )
      refresh();
  });
  refresh();
  return unsubscribe;
}
