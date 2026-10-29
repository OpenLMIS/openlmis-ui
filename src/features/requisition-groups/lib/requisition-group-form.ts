import { z } from 'zod';
import { programName } from '@/features/reference-data/lib/programs';
import type {
  MemberFacility,
  ProgramSchedule,
  RequisitionGroup,
} from '@/features/reference-data/lib/types';
import type { RequisitionGroupBody } from '@/features/requisition-groups/lib/types';

const choice = (message: string) => z.string().nullable().refine(Boolean, message);
const scheduleSchema = z.object({
  id: z.string().optional(),
  program: z.object({
    id: z.string().min(1, 'requisition-groups.form.program-required'),
    name: z.string().optional(),
  }),
  processingSchedule: z.object({
    id: z.string().min(1, 'requisition-groups.form.schedule-required'),
    name: z.string().optional(),
    code: z.string().optional(),
  }),
  dropOffFacility: z.object({ id: z.string() }).nullable().optional(),
  directDelivery: z.boolean(),
});
export const requisitionGroupFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'requisition-groups.form.name-required')
    .max(50, 'requisition-groups.form.name-too-long'),
  code: z
    .string()
    .trim()
    .min(1, 'requisition-groups.form.code-required')
    .max(50, 'requisition-groups.form.code-too-long'),
  nodeId: choice('requisition-groups.form.node-required'),
  schedules: z.array(scheduleSchema),
  members: z.array(z.custom<MemberFacility>()),
});
export type RequisitionGroupFormValues = z.input<typeof requisitionGroupFormSchema>;
export function addProgramSchema(rows: readonly ProgramSchedule[]) {
  return z.object({
    programId: choice('requisition-groups.form.program-required').refine(
      (id) => !rows.some((row) => row.program.id === id),
      'requisition-groups.form.program-listed',
    ),
    scheduleId: choice('requisition-groups.form.schedule-required'),
    dropOffId: z.string().nullable(),
    directDelivery: z.boolean(),
  });
}
export function toFormValues(saved?: RequisitionGroup): RequisitionGroupFormValues {
  return {
    name: saved?.name ?? '',
    code: saved?.code ?? '',
    nodeId: saved?.supervisoryNode.id ?? null,
    schedules: (saved?.requisitionGroupProgramSchedules ?? []).map((row) => ({
      ...row,
      directDelivery: Boolean(row.directDelivery),
    })),
    members: saved?.memberFacilities ?? [],
  };
}
export function availablePrograms<T extends { id: string; code: string; name: string | null }>(
  programs: readonly T[],
  rows: readonly ProgramSchedule[],
) {
  const listed = new Set(rows.map((row) => row.program.id));
  return programs
    .filter((program) => !listed.has(program.id))
    .sort((a, b) => programName(a).localeCompare(programName(b)));
}
type RequisitionGroupTab = 'programs' | 'facilities';
export function tabWithFirstError(fields: readonly string[]): RequisitionGroupTab | undefined {
  if (fields.some((name) => name.startsWith('schedules'))) return 'programs';
  if (fields.some((name) => name.startsWith('members'))) return 'facilities';
  return undefined;
}
export function toRequisitionGroupBody(
  values: RequisitionGroupFormValues,
  saved?: RequisitionGroup,
): RequisitionGroupBody {
  const savedIds = new Map(
    saved?.requisitionGroupProgramSchedules.map((row) => [row.program.id, row.id]),
  );
  const schedules = values.schedules.map((row) => {
    const id = savedIds.get(row.program.id) ?? row.id;
    return {
      ...(id && { id }),
      program: { id: row.program.id },
      processingSchedule: { id: row.processingSchedule.id },
      directDelivery: Boolean(row.directDelivery),
      ...(row.dropOffFacility?.id && { dropOffFacility: { id: row.dropOffFacility.id } }),
    };
  });
  return {
    ...(saved && { id: saved.id }),
    ...(saved?.description !== undefined && { description: saved.description }),
    name: values.name.trim(),
    code: values.code.trim(),
    supervisoryNode: { id: values.nodeId ?? '' },
    memberFacilities: values.members.map(({ id, code }) => ({ id, code })),
    requisitionGroupProgramSchedules: [
      ...schedules.filter((row) => row.id),
      ...schedules.filter((row) => !row.id),
    ],
  };
}
