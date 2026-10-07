import { type NamedRecord, recordLabel } from '@/lib/facility-program-selection';

type HomeStockProgramSources = {
  homeFacility:
    | {
        id: string;
        supportedPrograms?: readonly { id: string }[];
      }
    | null
    | undefined;
  programs: readonly NamedRecord[];
  grants: readonly { facilityId: string; programId: string }[];
};

export function homeStockPrograms({ homeFacility, programs, grants }: HomeStockProgramSources) {
  if (!homeFacility) return [];
  const supported = new Set(homeFacility.supportedPrograms?.map((program) => program.id));
  const granted = new Set(
    grants.filter((grant) => grant.facilityId === homeFacility.id).map((grant) => grant.programId),
  );
  return programs
    .filter((program) => supported.has(program.id) && granted.has(program.id))
    .sort((a, b) => recordLabel(a).localeCompare(recordLabel(b)) || a.code.localeCompare(b.code));
}
