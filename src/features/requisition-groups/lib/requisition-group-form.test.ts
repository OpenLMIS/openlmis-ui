import { describe, expect, it } from 'vitest';
import {
  addProgramSchema,
  availablePrograms,
  requisitionGroupFormSchema,
  tabWithFirstError,
  toFormValues,
  toRequisitionGroupBody,
} from '@/features/requisition-groups/lib/requisition-group-form';
import type { ProgramSchedule, RequisitionGroup } from '@/features/requisition-groups/lib/types';

const row = (program: string, id?: string): ProgramSchedule => ({
  ...(id && { id }),
  program: { id: program, name: program },
  processingSchedule: { id: 'schedule' },
  directDelivery: false,
});
const saved: RequisitionGroup = {
  id: 'group',
  name: 'Group',
  code: 'RG',
  description: ' Keep this ',
  supervisoryNode: { id: 'node', name: 'Node' },
  requisitionGroupProgramSchedules: [row('p1', 'row1'), row('p2', 'row2')],
  memberFacilities: [{ id: 'f1', code: 'F1', name: 'Facility', enabled: true }],
};

describe('requisition group form', () => {
  it.each(['   ', 'x'.repeat(51)])('refuses invalid name and code: %j', (text) => {
    const result = requisitionGroupFormSchema.safeParse({
      ...toFormValues(saved),
      name: text,
      code: text,
      nodeId: null,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(['name', 'code', 'nodeId']);
  });

  it('trims valid names and codes and allows empty collections', () => {
    expect(
      requisitionGroupFormSchema.parse({
        ...toFormValues(),
        name: ' Group ',
        code: ' RG ',
        nodeId: 'node',
      }),
    ).toMatchObject({ name: 'Group', code: 'RG', schedules: [], members: [] });
  });

  it('requires a program and schedule and refuses an already listed program', () => {
    const schema = addProgramSchema(saved.requisitionGroupProgramSchedules);
    const empty = { programId: null, scheduleId: null, dropOffId: null, directDelivery: false };
    expect(schema.safeParse(empty).success).toBe(false);
    expect(schema.safeParse({ ...empty, programId: 'p1', scheduleId: 's1' }).success).toBe(false);
    expect(schema.safeParse({ ...empty, programId: 'p3', scheduleId: 's1' }).success).toBe(true);
    expect(
      availablePrograms(
        [
          { id: 'p1', name: 'One' },
          { id: 'p3', name: 'Three' },
        ],
        saved.requisitionGroupProgramSchedules,
      ).map((program) => program.id),
    ).toEqual(['p3']);
  });

  it('keeps saved rows first, reuses a removed program id and sends only the member id and code', () => {
    const values = {
      ...toFormValues(saved),
      name: ' Group ',
      code: ' RG ',
      schedules: [
        row('p3'),
        { ...row('p1'), directDelivery: undefined as unknown as boolean },
        row('p2', 'row2'),
      ],
    };
    const body = toRequisitionGroupBody(values, saved, 'path-id');
    expect(body).toEqual({
      id: 'path-id',
      name: 'Group',
      code: 'RG',
      description: ' Keep this ',
      supervisoryNode: { id: 'node' },
      memberFacilities: [{ id: 'f1', code: 'F1' }],
      requisitionGroupProgramSchedules: [
        {
          id: 'row1',
          program: { id: 'p1' },
          processingSchedule: { id: 'schedule' },
          directDelivery: false,
        },
        {
          id: 'row2',
          program: { id: 'p2' },
          processingSchedule: { id: 'schedule' },
          directDelivery: false,
        },
        { program: { id: 'p3' }, processingSchedule: { id: 'schedule' }, directDelivery: false },
      ],
    });
  });

  it('omits edit-only data on add and passes drop-off ids', () => {
    const values = {
      ...toFormValues(saved),
      schedules: [{ ...row('p3'), dropOffFacility: { id: 'drop' }, directDelivery: true }],
    };
    const body = toRequisitionGroupBody(values);
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('description');
    expect(body.requisitionGroupProgramSchedules[0]).toMatchObject({
      dropOffFacility: { id: 'drop' },
      directDelivery: true,
    });
  });

  it('chooses tabs only for collection errors, with programs taking precedence', () => {
    expect(tabWithFirstError([])).toBeUndefined();
    expect(tabWithFirstError(['members[0].code'])).toBe('facilities');
    expect(tabWithFirstError(['schedules[0].program.id'])).toBe('programs');
    expect(tabWithFirstError(['name', 'code', 'nodeId'])).toBeUndefined();
    expect(tabWithFirstError(['members[0].code', 'name'])).toBe('facilities');
    expect(tabWithFirstError(['members[0].code', 'schedules[0].program.id'])).toBe('programs');
  });
});
