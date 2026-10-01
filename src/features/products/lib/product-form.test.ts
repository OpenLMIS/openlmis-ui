import { describe, expect, it } from 'vitest';
import {
  EMPTY_PRODUCT_FORM,
  isDuplicateCode,
  type ProductFormValues,
  productFormSchema,
  toCreateProductBody,
} from '@/features/products/lib/product-form';
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
