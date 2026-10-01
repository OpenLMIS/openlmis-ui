import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { FacilityBody } from '@/features/facilities/lib/types';
import { programName } from '@/features/reference-data/lib/programs';
import type { Program } from '@/features/reference-data/lib/types';

const errorKey = (key: ParseKeys) => key;

const requiredText = (key: ParseKeys) =>
  z.string().refine((value) => value.trim().length > 0, errorKey(key));

const requiredChoice = (key: ParseKeys) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), errorKey(key));

const comparableCode = (code: string) => code.trim().toLowerCase();

const programRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  supportActive: z.boolean(),
  supportLocallyFulfilled: z.boolean(),
  supportStartDate: requiredText('facilities.form.start-date-required'),
  /** Already stored on the facility, so it stays; a row added on this page can be removed. */
  saved: z.boolean(),
});

export function facilityFormSchema(refusedCodes: readonly string[]) {
  const refused = new Set(refusedCodes.map(comparableCode));
  return z.object({
    name: requiredText('facilities.form.name-required'),
    code: requiredText('facilities.form.code-required').refine(
      (code) => !refused.has(comparableCode(code)),
      errorKey('facilities.form.code-taken'),
    ),
    typeId: requiredChoice('facilities.form.type-required'),
    zoneId: requiredChoice('facilities.form.zone-required'),
    goLiveDate: z.string(),
    active: z.boolean(),
    enabled: z.boolean(),
    description: z.string(),
    operatorId: z.string().nullable(),
    programs: z.array(programRowSchema),
  });
}

export type FacilityFormValues = z.input<ReturnType<typeof facilityFormSchema>>;

export type ProgramRow = z.input<typeof programRowSchema>;

export const EMPTY_FACILITY_FORM: FacilityFormValues = {
  name: '',
  code: '',
  typeId: null,
  zoneId: null,
  goLiveDate: '',
  active: true,
  enabled: true,
  description: '',
  operatorId: null,
  programs: [],
};

export function toFacilityBody(values: FacilityFormValues): FacilityBody {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: values.description.trim() || null,
    active: values.active,
    enabled: values.enabled,
    goLiveDate: values.goLiveDate || null,
    type: { id: values.typeId ?? '' },
    geographicZone: { id: values.zoneId ?? '' },
    operator: values.operatorId ? { id: values.operatorId } : null,
    supportedPrograms: values.programs.map((row) => ({
      id: row.id,
      code: row.code,
      supportActive: row.supportActive,
      supportLocallyFulfilled: row.supportLocallyFulfilled,
      supportStartDate: row.supportStartDate,
    })),
  };
}

export function toProgramRow(program: Program, startDate: string): ProgramRow {
  return {
    id: program.id,
    code: program.code,
    name: program.name,
    supportActive: true,
    supportLocallyFulfilled: false,
    supportStartDate: startDate,
    saved: false,
  };
}

export function availablePrograms(programs: readonly Program[], rows: readonly ProgramRow[]) {
  const added = new Set(rows.map((row) => row.id));
  return programs
    .filter((program) => !added.has(program.id))
    .sort((a, b) => programName(a).localeCompare(programName(b)));
}

export type FacilityTab = 'information' | 'programs';

/** The tab to open after a failed Create, given the names of the fields that are wrong. */
export function tabWithFirstError(fieldNames: readonly string[]): FacilityTab | undefined {
  if (fieldNames.length === 0) return undefined;
  return fieldNames.some((name) => !name.startsWith('programs')) ? 'information' : 'programs';
}

export function isDuplicateCode(error: unknown) {
  return (
    isAxiosError<{ messageKey?: string }>(error) &&
    error.response?.data?.messageKey === 'referenceData.error.facility.code.mustBeUnique'
  );
}
