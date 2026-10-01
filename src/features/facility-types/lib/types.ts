import type { FacilityType } from '@/features/reference-data/lib/types';

export type FacilityTypesQuery = {
  page: number;
  size: number;
  sort: string;
};

export type FacilityTypeBody = Omit<FacilityType, 'id' | 'description'>;
