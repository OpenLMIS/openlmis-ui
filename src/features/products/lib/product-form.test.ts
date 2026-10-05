import { describe, expect, it } from 'vitest';
import {
  EMPTY_PRODUCT_FORM,
  hasProductChanges,
  isDuplicateCode,
  needsDispensingUnit,
  type ProductFormValues,
  productFormSchema,
  toCreateProductBody,
  toProductFormValues,
  toProductUpdateBody,
} from '@/features/products/lib/product-form';
import type { ProductDetail } from '@/features/products/lib/types';
import { httpError } from '@/tests/http-error';

const valid: ProductFormValues = {
  ...EMPTY_PRODUCT_FORM,
  productCode: 'C100',
  dispensingUnit: 'each',
  netContent: '10',
  packRoundingThreshold: '5',
};

const messages = (values: ProductFormValues, refusedCodes: string[] = []) =>
  productFormSchema(refusedCodes)
    .safeParse(values)
    .error?.issues.map((issue) => [issue.path[0], issue.message]);

describe('productFormSchema', () => {
  it('starts a new product empty, with Round to Zero off', () => {
    expect(EMPTY_PRODUCT_FORM).toEqual({
      productCode: '',
      fullProductName: '',
      description: '',
      dispensingUnit: '',
      netContent: '',
      packRoundingThreshold: '',
      roundToZero: false,
    });
  });

  it('accepts a product with only the required fields', () => {
    expect(messages(valid)).toBeUndefined();
  });

  it('requires a code, a dispensing unit and both pack sizes, counting spaces alone as empty', () => {
    expect(messages({ ...EMPTY_PRODUCT_FORM, productCode: ' ', dispensingUnit: '  ' })).toEqual([
      ['productCode', 'products.form.code-required'],
      ['dispensingUnit', 'products.form.dispensing-unit-required'],
      ['netContent', 'products.form.net-content-required'],
      ['packRoundingThreshold', 'products.form.pack-rounding-threshold-required'],
    ]);
  });

  it('takes whole numbers only, without rewriting what was typed', () => {
    for (const value of ['1.5', '-5', '1e3', 'abc']) {
      expect(messages({ ...valid, netContent: value, packRoundingThreshold: value })).toEqual([
        ['netContent', 'products.form.whole-number'],
        ['packRoundingThreshold', 'products.form.whole-number'],
      ]);
    }
  });

  it('needs a pack of at least 1, but lets the rounding threshold be 0', () => {
    expect(messages({ ...valid, netContent: '0', packRoundingThreshold: '0' })).toEqual([
      ['netContent', 'products.form.net-content-too-small'],
    ]);
  });

  it('takes pack sizes up to the largest whole number the browser holds exactly', () => {
    expect(
      messages({ ...valid, netContent: '9007199254740991', packRoundingThreshold: '2147483648' }),
    ).toBeUndefined();
    expect(messages({ ...valid, netContent: '9007199254740992' })).toEqual([
      ['netContent', 'products.form.too-large'],
    ]);
  });

  it('flags a code the server refused as in use, ignoring case and spaces', () => {
    expect(messages({ ...valid, productCode: ' c 100 ' }, ['C100'])).toEqual([
      ['productCode', 'products.form.code-taken'],
    ]);
    expect(messages({ ...valid, productCode: 'C101' }, ['C100'])).toBeUndefined();
  });
});

describe('toCreateProductBody', () => {
  it('sends the code as the server stores it, without spaces', () => {
    expect(toCreateProductBody({ ...valid, productCode: ' AB C ' }).productCode).toBe('ABC');
  });

  it('leaves out a blank name and description, and trims the rest', () => {
    expect(toCreateProductBody({ ...valid, fullProductName: '  ', description: '' })).toEqual({
      productCode: 'C100',
      fullProductName: undefined,
      description: undefined,
      dispensable: { dispensingUnit: 'each' },
      netContent: 10,
      packRoundingThreshold: 5,
      roundToZero: false,
    });
    expect(
      toCreateProductBody({
        ...valid,
        fullProductName: ' Aspirin ',
        description: ' Tablets ',
        dispensingUnit: ' strip ',
        netContent: '١٠',
        roundToZero: true,
      }),
    ).toMatchObject({
      fullProductName: 'Aspirin',
      description: 'Tablets',
      dispensable: { dispensingUnit: 'strip' },
      netContent: 10,
      roundToZero: true,
    });
  });
});

describe('isDuplicateCode', () => {
  it('recognises the server refusing a code already in use, and nothing else', () => {
    const refusal = (messageKey: string) => {
      const error = httpError(400);
      Object.assign(error.response ?? {}, { data: { messageKey } });
      return error;
    };
    expect(isDuplicateCode(refusal('referenceData.error.orderable.productCode.mustBeUnique'))).toBe(
      true,
    );
    expect(isDuplicateCode(refusal('referenceData.error.orderable.netContent.required'))).toBe(
      false,
    );
    expect(isDuplicateCode(new Error('offline'))).toBe(false);
  });
});

const saved: ProductDetail = {
  id: 'o1',
  productCode: 'C100',
  fullProductName: 'Levora',
  description: 'Oral contraceptive',
  netContent: 28,
  packRoundingThreshold: 0,
  roundToZero: true,
  dispensable: { dispensingUnit: 'each', displayUnit: 'each' },
  programs: [{ programId: 'p1', pricePerPack: 1.5 }],
  children: [{ orderable: { id: 'o2' }, quantity: 3 }],
  identifiers: { tradeItem: 't1' },
  extraData: { useVVM: 'true' },
  meta: { versionNumber: 4, lastUpdated: '2026-09-30T10:00:00Z' },
};

describe('toProductFormValues', () => {
  it('fills the form with the saved product, numbers as text', () => {
    expect(toProductFormValues(saved)).toEqual({
      productCode: 'C100',
      fullProductName: 'Levora',
      description: 'Oral contraceptive',
      dispensingUnit: 'each',
      netContent: '28',
      packRoundingThreshold: '0',
      roundToZero: true,
    });
  });

  it('shows missing text as empty fields', () => {
    expect(
      toProductFormValues({
        ...saved,
        fullProductName: null,
        description: null,
        dispensable: {},
      }),
    ).toMatchObject({ fullProductName: '', description: '', dispensingUnit: '' });
  });
});

describe('toProductUpdateBody', () => {
  it('keeps every part of the saved product the form does not show', () => {
    const body = toProductUpdateBody(toProductFormValues(saved), saved);

    expect(body).toEqual(saved);
  });

  it('changes only what the form changed', () => {
    const body = toProductUpdateBody(
      {
        ...toProductFormValues(saved),
        productCode: ' C 101 ',
        fullProductName: ' Levora Plus ',
        description: '  ',
        dispensingUnit: ' strip ',
        netContent: '30',
        roundToZero: false,
      },
      saved,
    );

    expect(body).toEqual({
      ...saved,
      productCode: 'C101',
      fullProductName: 'Levora Plus',
      description: null,
      dispensable: { dispensingUnit: 'strip', displayUnit: 'each' },
      netContent: 30,
      roundToZero: false,
    });
  });
});

describe('hasProductChanges', () => {
  const values = toProductFormValues(saved);

  it('sees nothing to save in the product as loaded', () => {
    expect(hasProductChanges(values, saved)).toBe(false);
  });

  it('sees nothing to save in a product saved with stray spaces or an empty description', () => {
    const padded = {
      ...saved,
      fullProductName: 'BACTEC MGIT 960 Supplement ',
      description: '',
      dispensable: { dispensingUnit: ' each ', displayUnit: 'each' },
    };
    expect(hasProductChanges(toProductFormValues(padded), padded)).toBe(false);
  });

  it('ignores spaces the save would take out anyway', () => {
    expect(
      hasProductChanges(
        { ...values, productCode: ' C100 ', fullProductName: 'Levora ', netContent: ' 28' },
        saved,
      ),
    ).toBe(false);
  });

  it('sees each field changed, including one emptied or no longer a number', () => {
    for (const change of [
      { productCode: 'C101' },
      { fullProductName: '' },
      { description: 'Other' },
      { dispensingUnit: 'strip' },
      { netContent: '29' },
      { packRoundingThreshold: 'abc' },
      { packRoundingThreshold: '' },
      { roundToZero: false },
    ]) {
      expect(hasProductChanges({ ...values, ...change }, saved)).toBe(true);
    }
  });
});

describe('a product sized by a size code', () => {
  const vaccine: ProductDetail = {
    ...saved,
    dispensable: { sizeCode: '5 dose', routeOfAdministration: 'injection', displayUnit: '5 dose' },
  };
  const values = toProductFormValues(vaccine);

  it('needs no dispensing unit, as legacy', () => {
    expect(needsDispensingUnit(vaccine)).toBe(false);
    expect(needsDispensingUnit(saved)).toBe(true);
    expect(productFormSchema([], { unitRequired: false }).safeParse(values).success).toBe(true);
    expect(productFormSchema([]).safeParse(values).success).toBe(false);
  });

  it('keeps its pack size as it was when no unit is entered', () => {
    const body = toProductUpdateBody({ ...values, fullProductName: 'BCG' }, vaccine);

    expect(body.dispensable).toEqual(vaccine.dispensable);
    expect(hasProductChanges(values, vaccine)).toBe(false);
  });
});
