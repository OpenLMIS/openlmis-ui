import type { QueryKey } from '@tanstack/react-query';
import type { Page } from '@/lib/types';

export type AssignmentKind = 'destinations' | 'sources';

/** A place a facility type may issue to or receive from in a program; the node is a facility or an organization. */
export type ValidAssignment = {
  id: string;
  programId: string;
  facilityTypeId: string;
  node: { id: string; referenceId: string; refDataFacility: boolean };
  name: string | null;
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

/** `created` is false when the server already had one for the same program, type and node. */
export type SavedAssignment = { assignment: ValidAssignment; created: boolean };

/** What a feature hands the shared screen: its endpoints and the cache scope they live under. */
export type AssignmentsApi = {
  kind: AssignmentKind;
  queryKey: QueryKey;
  fetchList: (query: AssignmentsQuery) => Promise<Page<ValidAssignment>>;
  create: (body: AssignmentBody) => Promise<SavedAssignment>;
  remove: (id: string) => Promise<void>;
};
