import type { QueryKey, UseSuspenseQueryOptions } from '@tanstack/react-query';
import type { Page } from '@/lib/types';

export type AssignmentKind = 'destinations' | 'sources';

export type ValidAssignment = {
  id: string;
  programId: string;
  facilityTypeId: string;
  node: { id: string; referenceId: string; refDataFacility: boolean };
  name: string | null;
  isFreeTextAllowed?: boolean;
  geoLevelAffinityId: string | null;
};

export type AssignmentsQuery = {
  page: number;
  size: number;
  sort: string[];
  programId?: string;
  facilityId?: string;
};

export type AssignmentBody = {
  programId: string;
  facilityTypeId: string;
  node: { referenceId: string };
  geoLevelAffinityId?: string;
};

export type SavedAssignment = { assignment: ValidAssignment; created: boolean };

export type AssignmentsApi = {
  kind: AssignmentKind;
  queryKey: QueryKey;
  listOptions: (query: AssignmentsQuery) => UseSuspenseQueryOptions<Page<ValidAssignment>>;
  create: (body: AssignmentBody) => Promise<SavedAssignment>;
  remove: (id: string) => Promise<void>;
};
