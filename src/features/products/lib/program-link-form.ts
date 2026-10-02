import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { ProductDetail } from '@/features/products/lib/types';
import type { Program } from '@/features/reference-data/lib/types';
import { decimalText, toDecimal, toNumberText } from '@/lib/decimal';
import { toOptionalWholeNumber, wholeNumberText } from '@/lib/whole-number';

const errorKey = (key: ParseKeys) => key;

const optionalWholeNumber = () =>
  wholeNumberText(
    {
      invalid: errorKey('products.programs.form.whole-number'),
      tooLarge: errorKey('products.programs.form.too-large'),
    },
    { optional: true },
  );

export function programLinkFormSchema() {
  return z.object({
    programId: z
      .string()
      .nullable()
      .refine(Boolean, errorKey('products.programs.form.program-required')),
    fullSupply: z.boolean(),
    dosesPerPatient: optionalWholeNumber(),
    orderableDisplayCategoryId: z
      .string()
      .nullable()
      .refine(Boolean, errorKey('products.programs.form.category-required')),
    displayOrder: optionalWholeNumber(),
    pricePerPack: decimalText(
      {
        invalid: errorKey('products.programs.form.price-invalid'),
        tooLarge: errorKey('products.programs.form.price-too-large'),
        tooPrecise: errorKey('products.programs.form.price-too-precise'),
      },
      { optional: true, maxDecimals: 2 },
    ),
  });
}

export type ProgramLinkFormValues = z.infer<ReturnType<typeof programLinkFormSchema>>;

export const EMPTY_PROGRAM_LINK_FORM: ProgramLinkFormValues = {
  programId: null,
  fullSupply: false,
  dosesPerPatient: '',
  orderableDisplayCategoryId: null,
  displayOrder: '',
  pricePerPack: '',
};

export function toProgramLinkFormValues(link: ProductDetail['programs'][number]) {
  return {
    programId: link.programId,
    fullSupply: link.fullSupply ?? false,
    dosesPerPatient: toNumberText(link.dosesPerPatient),
    orderableDisplayCategoryId: link.orderableDisplayCategoryId ?? null,
    displayOrder: toNumberText(link.displayOrder),
    pricePerPack: toNumberText(link.pricePerPack),
  } satisfies ProgramLinkFormValues;
}

export function withProgramLink(
  product: ProductDetail,
  values: ProgramLinkFormValues,
): ProductDetail {
  const programId = values.programId ?? '';
  const fields = {
    fullSupply: values.fullSupply,
    dosesPerPatient: toOptionalWholeNumber(values.dosesPerPatient),
    orderableDisplayCategoryId: values.orderableDisplayCategoryId,
    displayOrder: toOptionalWholeNumber(values.displayOrder),
    pricePerPack: toDecimal(values.pricePerPack),
  };
  const linked = product.programs.some((link) => link.programId === programId);
  return {
    ...product,
    programs: linked
      ? product.programs.map((link) =>
          link.programId === programId ? { ...link, ...fields } : link,
        )
      : [...product.programs, { programId, active: true, ...fields }],
  };
}

export function withoutProgramLink(product: ProductDetail, programId: string): ProductDetail {
  return { ...product, programs: product.programs.filter((link) => link.programId !== programId) };
}

export function unlinkedPrograms(programs: readonly Program[], product: ProductDetail) {
  const linked = new Set(product.programs.map((link) => link.programId));
  return programs.filter((program) => !linked.has(program.id));
}
