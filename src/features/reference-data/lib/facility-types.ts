import type { FacilityType } from '@/features/reference-data/lib/types';

export const facilityTypeName = (type: Pick<FacilityType, 'code' | 'name'>) =>
  type.name || type.code;
