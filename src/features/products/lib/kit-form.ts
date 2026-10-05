import type { ParseKeys } from 'i18next';
import { z } from 'zod';
import type { KitChild, Product, ProductDetail } from '@/features/products/lib/types';
import { toNumberText } from '@/lib/decimal';
import { toWholeNumber, wholeNumberText } from '@/lib/whole-number';

const errorKey = (key: ParseKeys) => key;

export function kitFormSchema() {
  return z.object({
    children: z.array(
      z.object({
        id: z.string(),
        code: z.string(),
        name: z.string(),
        quantity: wholeNumberText({
          required: errorKey('products.kit.quantity-required'),
          invalid: errorKey('products.kit.whole-number'),
          tooLarge: errorKey('products.kit.too-large'),
        }),
      }),
    ),
  });
}

export type KitFormValues = z.infer<ReturnType<typeof kitFormSchema>>;

type KitRow = KitFormValues['children'][number];

export const toKitRow = (product: Product, quantity = ''): KitRow => ({
  id: product.id,
  code: product.productCode,
  name: product.fullProductName ?? '',
  quantity,
});

export function toKitFormValues(kit: ProductDetail, products: readonly Product[]): KitFormValues {
  const known = new Map(products.map((product) => [product.id, product]));
  return {
    children: (kit.children ?? []).map((child) => {
      const quantity = toNumberText(child.quantity);
      const product = known.get(child.orderable.id);
      return product
        ? toKitRow(product, quantity)
        : { id: child.orderable.id, code: child.orderable.id, name: '', quantity };
    }),
  };
}

export function toKitBody(values: KitFormValues, kit: ProductDetail): ProductDetail {
  const saved = new Map((kit.children ?? []).map((child) => [child.orderable.id, child]));
  return {
    ...kit,
    children: values.children.map(
      (row): KitChild => ({
        ...(saved.get(row.id) ?? { orderable: { id: row.id } }),
        quantity: toWholeNumber(row.quantity),
      }),
    ),
  };
}

export function hasKitChanges(values: KitFormValues, kit: ProductDetail) {
  const saved = new Map((kit.children ?? []).map((child) => [child.orderable.id, child.quantity]));
  return (
    values.children.length !== saved.size ||
    values.children.some(
      (row) =>
        !saved.has(row.id) ||
        row.quantity.trim() === '' ||
        toWholeNumber(row.quantity) !== saved.get(row.id),
    )
  );
}
