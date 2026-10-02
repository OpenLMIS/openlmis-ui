import { describe, expect, it } from 'vitest';
import {
  hasKitChanges,
  kitFormSchema,
  toKitBody,
  toKitFormValues,
  toKitRow,
} from '@/features/products/lib/kit-form';
import type { Product, ProductDetail } from '@/features/products/lib/types';

const product = (id: string, code: string, name: string): Product => ({
  id,
  productCode: code,
  fullProductName: name,
  description: null,
});

const gloves = product('g1', 'G1', 'Gloves');
const syringe = product('s1', 'S1', 'Syringe');
const swab = product('w1', 'W1', 'Swab');

const kit: ProductDetail = {
  id: 'k1',
  productCode: 'KIT1',
  fullProductName: 'Delivery Kit',
  description: null,
  netContent: 1,
  packRoundingThreshold: 0,
  roundToZero: false,
  dispensable: { dispensingUnit: 'kit' },
  programs: [],
  children: [
    { orderable: { id: 'g1', href: '/orderables/g1' }, quantity: 2 },
    { orderable: { id: 's1' }, quantity: 5 },
  ],
  identifiers: { tradeItem: 't1' },
};

const withPicked = (values: { children: KitRow[] }, picked: Product[]) => ({
  children: [...values.children, ...picked.map((item) => toKitRow(item))],
});

type KitRow = ReturnType<typeof toKitRow>;

const messages = (rows: { quantity: string }[]) =>
  kitFormSchema()
    .safeParse({
      children: rows.map((row, index) => ({ ...row, id: `p${index}`, code: '', name: '' })),
    })
    .error?.issues.map((issue) => [issue.path.join('.'), issue.message]);

describe('toKitFormValues', () => {
  it('lists the kit products by name, with their quantities as text', () => {
    expect(toKitFormValues(kit, [syringe, gloves])).toEqual({
      children: [
        { id: 'g1', code: 'G1', name: 'Gloves', quantity: '2' },
        { id: 's1', code: 'S1', name: 'Syringe', quantity: '5' },
      ],
    });
  });

  it('keeps a product it cannot name, by its id', () => {
    expect(toKitFormValues(kit, [gloves]).children[1]).toEqual({
      id: 's1',
      code: 's1',
      name: '',
      quantity: '5',
    });
  });
});

describe('kitFormSchema', () => {
  it('takes a whole number from 0 as legacy, and nothing else', () => {
    expect(messages([{ quantity: '0' }, { quantity: '12' }])).toBeUndefined();
    expect(messages([{ quantity: '' }, { quantity: '1.5' }, { quantity: '2147483648' }])).toEqual([
      ['children.0.quantity', 'products.kit.quantity-required'],
      ['children.1.quantity', 'products.kit.whole-number'],
      ['children.2.quantity', 'products.kit.too-large'],
    ]);
  });
});

describe('toKitRow', () => {
  it('lists a picked product with no quantity yet', () => {
    expect(toKitRow(swab)).toEqual({
      id: 'w1',
      code: 'W1',
      name: 'Swab',
      quantity: '',
    });
  });
});

describe('toKitBody', () => {
  it('keeps every part of the kit the tab does not show, and each child as it was', () => {
    expect(toKitBody(toKitFormValues(kit, [gloves, syringe]), kit)).toEqual(kit);
  });

  it('sends the quantities and products as edited', () => {
    const values = toKitFormValues(kit, [gloves, syringe]);
    const edited = withPicked({ children: [{ ...values.children[0], quantity: ' ٣ ' }] }, [swab]);
    edited.children[1].quantity = '0';

    expect(toKitBody(edited, kit)).toEqual({
      ...kit,
      children: [
        { orderable: { id: 'g1', href: '/orderables/g1' }, quantity: 3 },
        { orderable: { id: 'w1' }, quantity: 0 },
      ],
    });
  });
});

describe('hasKitChanges', () => {
  const values = toKitFormValues(kit, [gloves, syringe]);

  it('sees nothing to save in the kit as loaded, in any order', () => {
    expect(hasKitChanges(values, kit)).toBe(false);
    expect(hasKitChanges({ children: values.children.toReversed() }, kit)).toBe(false);
  });

  it('sees a changed quantity, an emptied one, a removed product and an added one', () => {
    const [first, second] = values.children;
    expect(hasKitChanges({ children: [{ ...first, quantity: '3' }, second] }, kit)).toBe(true);
    expect(hasKitChanges({ children: [{ ...first, quantity: '' }, second] }, kit)).toBe(true);
    expect(hasKitChanges({ children: [first] }, kit)).toBe(true);
    expect(hasKitChanges(withPicked(values, [swab]), kit)).toBe(true);
  });
});
