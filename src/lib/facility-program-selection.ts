import { z } from 'zod';

export type SelectionMode = 'my' | 'supervised';

/** What the picker holds; the URL keeps the one last searched for. */
export type FacilityProgramSelection = {
  mode?: SelectionMode | undefined;
  programId?: string | undefined;
  facilityId?: string | undefined;
};

export type CompleteSelection = Required<{
  [Key in keyof FacilityProgramSelection]: NonNullable<FacilityProgramSelection[Key]>;
}>;

export type NamedRecord = { id: string; code: string; name: string | null };

/** What the options are built from: the user's home and programs, every facility, and the right's grants. */
export type FacilityProgramSources = {
  homeFacilityId: string | null | undefined;
  programs: readonly NamedRecord[];
  facilities: readonly NamedRecord[];
  grants: readonly { facilityId: string; programId: string }[];
};

export type FacilityProgramOptions = {
  home: NamedRecord | null;
  myPrograms: NamedRecord[];
  supervisedPrograms: NamedRecord[];
  facilitiesFor: (programId: string) => NamedRecord[];
};

export const recordLabel = (record: NamedRecord) => record.name || record.code;

const byLabel = (a: NamedRecord, b: NamedRecord) => recordLabel(a).localeCompare(recordLabel(b));

/** Legacy's picker: home programs first, then supervised programs granted away from home, then that program's facilities, home included. */
export function facilityProgramOptions({
  homeFacilityId,
  programs,
  facilities,
  grants,
}: FacilityProgramSources): FacilityProgramOptions {
  const home = facilities.find((facility) => facility.id === homeFacilityId) ?? null;
  const facilitiesByProgram = new Map<string, Set<string>>();
  for (const { facilityId, programId } of grants) {
    const granted = facilitiesByProgram.get(programId) ?? new Set();
    facilitiesByProgram.set(programId, granted.add(facilityId));
  }
  const grantedAt = (programId: string, matches: (facilityId: string) => boolean) =>
    [...(facilitiesByProgram.get(programId) ?? [])].some(matches);

  return {
    home,
    myPrograms: home
      ? programs.filter((program) => grantedAt(program.id, (id) => id === home.id)).sort(byLabel)
      : [],
    supervisedPrograms: programs
      .filter((program) => grantedAt(program.id, (id) => id !== homeFacilityId))
      .sort(byLabel),
    facilitiesFor: (programId) => {
      const granted = facilitiesByProgram.get(programId);
      return granted ? facilities.filter((facility) => granted.has(facility.id)).sort(byLabel) : [];
    },
  };
}

/** The picker's starting point: the link's selection, or my facility when the user has a home. */
export function initialSelection(
  applied: FacilityProgramSelection,
  options: FacilityProgramOptions,
): FacilityProgramSelection {
  const mode = applied.mode ?? (options.home ? 'my' : 'supervised');
  if (mode === 'my') return { mode, programId: applied.programId, facilityId: options.home?.id };
  return { mode, programId: applied.programId, facilityId: applied.facilityId };
}

export function changeMode(
  mode: SelectionMode,
  options: FacilityProgramOptions,
): FacilityProgramSelection {
  return mode === 'my' ? { mode, facilityId: options.home?.id } : { mode };
}

export function changeProgram(
  current: FacilityProgramSelection,
  programId: string | undefined,
  options: FacilityProgramOptions,
): FacilityProgramSelection {
  if (current.mode === 'my') return { ...current, programId };
  const keepsFacility =
    programId !== undefined &&
    options.facilitiesFor(programId).some((facility) => facility.id === current.facilityId);
  return {
    mode: current.mode,
    programId,
    facilityId: keepsFacility ? current.facilityId : undefined,
  };
}

export function isCompleteSelection(
  selection: FacilityProgramSelection,
): selection is CompleteSelection {
  return Boolean(selection.mode && selection.programId && selection.facilityId);
}

/** The selection when the picker would offer it, `null` when not, so a changed link is refused rather than followed. */
export function validSelection(
  selection: FacilityProgramSelection,
  options: FacilityProgramOptions,
): CompleteSelection | null {
  if (!isCompleteSelection(selection)) return null;
  const { mode, programId, facilityId } = selection;
  const hasId = (records: readonly NamedRecord[], id: string) =>
    records.some((record) => record.id === id);
  const offered =
    mode === 'my'
      ? facilityId === options.home?.id && hasId(options.myPrograms, programId)
      : hasId(options.supervisedPrograms, programId) &&
        hasId(options.facilitiesFor(programId), facilityId);
  return offered ? { mode, programId, facilityId } : null;
}

const idSchema = z.guid().optional().catch(undefined);

export const facilityProgramSearchSchema = z.object({
  mode: z.enum(['my', 'supervised']).optional().catch(undefined),
  programId: idSchema,
  facilityId: idSchema,
});
