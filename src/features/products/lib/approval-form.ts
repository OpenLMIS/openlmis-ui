import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { Approval, ApprovalStock } from '@/features/products/lib/types';
import { decimalText, toDecimal, toNumberText } from '@/lib/decimal';

const errorKey = (key: ParseKeys) => key;

const periods = (optional: boolean) =>
  decimalText(
    {
      required: errorKey('products.approvals.form.max-required'),
      invalid: errorKey('products.approvals.form.number'),
      tooLarge: errorKey('products.approvals.form.too-large'),
    },
    { optional },
  );

export function approvalFormSchema(approved: readonly Approval[], editingId?: string) {
  return z
    .object({
      facilityTypeId: z
        .string()
        .nullable()
        .refine(Boolean, errorKey('products.approvals.form.facility-type-required')),
      programId: z
        .string()
        .nullable()
        .refine(Boolean, errorKey('products.approvals.form.program-required')),
      maxPeriodsOfStock: periods(false),
      emergencyOrderPoint: periods(true),
      minPeriodsOfStock: periods(true),
    })
    .superRefine((values, context) => {
      const taken = approved.some(
        (approval) =>
          approval.id !== editingId &&
          approval.facilityType.id === values.facilityTypeId &&
          approval.program.id === values.programId,
      );
      if (taken) {
        context.addIssue({
          code: 'custom',
          path: ['programId'],
          message: errorKey('products.approvals.form.duplicate'),
        });
      }
    });
}

export type ApprovalFormValues = z.infer<ReturnType<typeof approvalFormSchema>>;

export const EMPTY_APPROVAL_FORM: ApprovalFormValues = {
  facilityTypeId: null,
  programId: null,
  maxPeriodsOfStock: '',
  emergencyOrderPoint: '',
  minPeriodsOfStock: '',
};

export function toApprovalFormValues(approval: Approval): ApprovalFormValues {
  return {
    facilityTypeId: approval.facilityType.id,
    programId: approval.program.id,
    maxPeriodsOfStock: toNumberText(approval.maxPeriodsOfStock),
    emergencyOrderPoint: toNumberText(approval.emergencyOrderPoint),
    minPeriodsOfStock: toNumberText(approval.minPeriodsOfStock),
  };
}

export function toApprovalStock(values: ApprovalFormValues): ApprovalStock {
  return {
    maxPeriodsOfStock: toDecimal(values.maxPeriodsOfStock) ?? 0,
    emergencyOrderPoint: toDecimal(values.emergencyOrderPoint),
    minPeriodsOfStock: toDecimal(values.minPeriodsOfStock),
  };
}
