import { z } from 'zod';
import type { AssignmentBody } from '@/components/valid-assignments/types';

export const assignmentFormSchema = z
  .object({
    programId: z.string().min(1, 'valid-assignments.form.program-required'),
    facilityTypeId: z.string().min(1, 'valid-assignments.form.facility-type-required'),
    nodeType: z.enum(['facility', 'organization']),
    facilityId: z.string().nullable(),
    organizationId: z.string(),
    geoLevelAffinityId: z.string().nullable(),
  })
  .superRefine((values, context) => {
    if (values.nodeType === 'facility' && !values.facilityId) {
      context.addIssue({
        code: 'custom',
        path: ['facilityId'],
        message: 'valid-assignments.form.facility-required',
      });
    }
    if (values.nodeType === 'organization' && !values.organizationId) {
      context.addIssue({
        code: 'custom',
        path: ['organizationId'],
        message: 'valid-assignments.form.organization-required',
      });
    }
  });

export type AssignmentFormValues = z.infer<typeof assignmentFormSchema>;

export const EMPTY_ASSIGNMENT_FORM: AssignmentFormValues = {
  programId: '',
  facilityTypeId: '',
  nodeType: 'facility',
  facilityId: null,
  organizationId: '',
  geoLevelAffinityId: null,
};

/** Only the node of the choice shown is sent; each side keeps its pick while the other is shown. */
export function toAssignmentBody(values: AssignmentFormValues): AssignmentBody {
  const referenceId =
    values.nodeType === 'facility' ? (values.facilityId ?? '') : values.organizationId;
  return {
    programId: values.programId,
    facilityTypeId: values.facilityTypeId,
    node: { referenceId },
    ...(values.geoLevelAffinityId && { geoLevelAffinityId: values.geoLevelAffinityId }),
  };
}
