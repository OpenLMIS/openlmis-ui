import { isAxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { CreateProductBody } from '@/features/products/lib/types';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

const errorKey = (key: ParseKeys) => key;

const toCode = (text: string) => text.replace(/\s/g, '');

const sameCode = (a: string, b: string) => toCode(a).toLowerCase() === toCode(b).toLowerCase();

const packSize = (required: ParseKeys, min = 0) =>
  wholeNumberText(
    {
      required,
      invalid: errorKey('products.form.whole-number'),
      tooLarge: errorKey('products.form.too-large'),
      tooSmall: errorKey('products.form.net-content-too-small'),
    },
    { min, max: Number.MAX_SAFE_INTEGER },
  );

export function productFormSchema(refusedCodes: readonly string[]) {
  return z.object({
    productCode: z
      .string()
      .trim()
      .min(1, errorKey('products.form.code-required'))
      .refine(
        (code) => !refusedCodes.some((refused) => sameCode(refused, code)),
        errorKey('products.form.code-taken'),
      ),
    fullProductName: z.string(),
    description: z.string(),
    dispensingUnit: z.string().trim().min(1, errorKey('products.form.dispensing-unit-required')),
    netContent: packSize(errorKey('products.form.net-content-required'), 1),
    packRoundingThreshold: packSize(errorKey('products.form.pack-rounding-threshold-required')),
    roundToZero: z.boolean(),
  });
}

export type ProductFormValues = z.infer<ReturnType<typeof productFormSchema>>;

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  productCode: '',
  fullProductName: '',
  description: '',
  dispensingUnit: '',
  netContent: '',
  packRoundingThreshold: '',
  roundToZero: false,
};

const optionalText = (text: string) => text.trim() || undefined;

export function toCreateProductBody(values: ProductFormValues): CreateProductBody {
  return {
    productCode: toCode(values.productCode),
    fullProductName: optionalText(values.fullProductName),
    description: optionalText(values.description),
    dispensable: { dispensingUnit: values.dispensingUnit.trim() },
    netContent: toWholeNumber(values.netContent),
    packRoundingThreshold: toWholeNumber(values.packRoundingThreshold),
    roundToZero: values.roundToZero,
  };
}

export function isDuplicateCode(error: unknown) {
  return (
    isAxiosError<{ messageKey?: string }>(error) &&
    error.response?.data?.messageKey === 'referenceData.error.orderable.productCode.mustBeUnique'
  );
}
