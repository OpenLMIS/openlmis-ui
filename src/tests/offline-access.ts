import type { Facility, Program } from '@/features/reference-data/lib/types';
import type { OfflineAccess } from '@/lib/offline-access';

type FixtureOptions = {
  userId?: string;
  home?: Partial<Facility> | null;
  programs?: Program[];
  rights?: string[];
};

export function offlineAccessFixture({
  userId = 'owner',
  home = { id: 'home' },
  programs = [{ id: 'p', code: 'P', name: 'Program', active: true }],
  rights = ['STOCK_CARDS_VIEW|home|p'],
}: FixtureOptions = {}): OfflineAccess {
  return {
    userId,
    permissionStrings: rights,
    user: {
      id: userId,
      username: 'user',
      firstName: '',
      lastName: '',
      active: true,
      roleAssignments: [],
      homeFacilityId: home?.id,
    },
    programs,
    homeFacility: home
      ? {
          id: 'home',
          code: 'H',
          name: 'Home',
          active: true,
          enabled: true,
          type: { id: 'type', code: 'T', name: 'Type' },
          geographicZone: { id: 'zone', code: 'Z', name: 'Zone', level: { name: 'District' } },
          supportedPrograms: programs.map((program) => ({
            ...program,
            supportActive: true,
            supportLocallyFulfilled: true,
          })),
          ...home,
        }
      : null,
    fetchedAt: Date.now(),
    generation: 'access',
    formatVersion: 1,
  };
}
