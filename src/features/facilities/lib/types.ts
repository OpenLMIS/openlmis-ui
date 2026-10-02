import type { SupportedProgram } from '@/features/reference-data/lib/types';

export type FacilitiesQuery = {
  page: number;
  size: number;
  sort: string;
  name?: string | undefined;
  zoneId?: string | undefined;
};

type Reference = { id: string };

export type FacilityBody = {
  code: string;
  name: string | null;
  description: string | null;
  active: boolean;
  enabled: boolean;
  goLiveDate: string | null;
  type: Reference;
  geographicZone: Reference;
  operator: Reference | null;
  supportedPrograms: Omit<SupportedProgram, 'name'>[];
};
