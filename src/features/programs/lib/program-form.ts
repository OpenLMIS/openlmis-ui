import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { ProgramBody } from '@/features/programs/lib/types';
import type { Program } from '@/features/reference-data/lib/types';

const errorKey = (key: ParseKeys) => key;

const withoutSpaces = (code: string) => code.replace(/\s/g, '');

export function programFormSchema(takenCodes: readonly string[]) {
  const taken = new Set(takenCodes.map(withoutSpaces));
  return z.object({
    code: z
      .string()
      .trim()
      .min(1, errorKey('programs.form.code-required'))
      .refine((code) => !taken.has(withoutSpaces(code)), errorKey('programs.form.code-taken')),
    name: z.string().trim().min(1, errorKey('programs.form.name-required')),
    description: z.string(),
    active: z.boolean(),
    showNonFullSupplyTab: z.boolean(),
    periodsSkippable: z.boolean(),
    skipAuthorization: z.boolean(),
    enableDatePhysicalStockCountCompleted: z.boolean(),
  });
}

export type ProgramFormValues = z.infer<ReturnType<typeof programFormSchema>>;

export const EMPTY_PROGRAM_FORM: ProgramFormValues = {
  code: '',
  name: '',
  description: '',
  active: true,
  showNonFullSupplyTab: false,
  periodsSkippable: false,
  skipAuthorization: false,
  enableDatePhysicalStockCountCompleted: false,
};

export function toProgramFormValues(program: Program): ProgramFormValues {
  return {
    code: program.code,
    name: program.name ?? '',
    description: program.description ?? '',
    active: program.active ?? false,
    showNonFullSupplyTab: program.showNonFullSupplyTab ?? false,
    periodsSkippable: program.periodsSkippable ?? false,
    skipAuthorization: program.skipAuthorization ?? false,
    enableDatePhysicalStockCountCompleted: program.enableDatePhysicalStockCountCompleted ?? false,
  };
}

export function toProgramBody(values: ProgramFormValues, saved?: Program): ProgramBody {
  return {
    ...saved,
    code: saved?.code ?? values.code.trim(),
    name: values.name.trim(),
    description: values.description.trim() || null,
    active: values.active,
    showNonFullSupplyTab: values.showNonFullSupplyTab,
    periodsSkippable: values.periodsSkippable,
    skipAuthorization: values.skipAuthorization,
    enableDatePhysicalStockCountCompleted: values.enableDatePhysicalStockCountCompleted,
  };
}

export function isDuplicateCode(error: unknown) {
  return (
    isAxiosError<{ messageKey?: string }>(error) &&
    error.response?.data?.messageKey === 'referenceData.error.program.code.duplicated'
  );
}
