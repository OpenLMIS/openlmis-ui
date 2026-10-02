import { describe, expect, it } from 'vitest';
import {
  assignmentFormSchema,
  EMPTY_ASSIGNMENT_FORM,
  toAssignmentBody,
} from '@/components/valid-assignments/assignment-form';

const filled = {
  ...EMPTY_ASSIGNMENT_FORM,
  programId: 'p1',
  facilityTypeId: 't1',
  facilityId: 'f1',
};

const messages = (values: unknown) =>
  assignmentFormSchema.safeParse(values).error?.issues.map((issue) => [issue.path, issue.message]);

describe('assignmentFormSchema', () => {
  it('starts as a facility with nothing picked', () => {
    expect(EMPTY_ASSIGNMENT_FORM).toEqual({
      programId: '',
      facilityTypeId: '',
      nodeType: 'facility',
      facilityId: null,
      organizationId: '',
      geoLevelAffinityId: null,
    });
  });

  it('requires the program, the facility type and the facility', () => {
    expect(messages(EMPTY_ASSIGNMENT_FORM)).toEqual([
      [['programId'], 'valid-assignments.form.program-required'],
      [['facilityTypeId'], 'valid-assignments.form.facility-type-required'],
      [['facilityId'], 'valid-assignments.form.facility-required'],
    ]);
  });

  it('requires the organization instead once the node is an organization', () => {
    expect(messages({ ...filled, nodeType: 'organization' })).toEqual([
      [['organizationId'], 'valid-assignments.form.organization-required'],
    ]);
  });

  it('accepts a filled form with no geo level affinity', () => {
    expect(assignmentFormSchema.safeParse(filled).success).toBe(true);
  });
});

describe('toAssignmentBody', () => {
  it('sends the facility as the node, without a geo level affinity left empty', () => {
    expect(toAssignmentBody({ ...filled, organizationId: 'o1' })).toEqual({
      programId: 'p1',
      facilityTypeId: 't1',
      node: { referenceId: 'f1' },
    });
  });

  it('sends the organization when that is the choice shown, and the level when picked', () => {
    expect(
      toAssignmentBody({
        ...filled,
        nodeType: 'organization',
        organizationId: 'o1',
        geoLevelAffinityId: 'l3',
      }),
    ).toEqual({
      programId: 'p1',
      facilityTypeId: 't1',
      node: { referenceId: 'o1' },
      geoLevelAffinityId: 'l3',
    });
  });
});
