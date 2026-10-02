import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROGRAM_LINK_FORM,
  type ProgramLinkFormValues,
  programLinkFormSchema,
  toProgramLinkFormValues,
  unlinkedPrograms,
  withoutProgramLink,
  withProgramLink,
} from '@/features/products/lib/program-link-form';
import type { ProductDetail, ProgramLink } from '@/features/products/lib/types';
import type { Program } from '@/features/reference-data/lib/types';

const familyPlanning: ProgramLink = {
  programId: 'fp',
  orderableDisplayCategoryId: 'c1',
  orderableCategoryDisplayName: 'Contraceptives',
  orderableCategoryDisplayOrder: 9,
  active: true,
  fullSupply: false,
  displayOrder: 6,
  dosesPerPatient: 1,
  pricePerPack: 20.77,
  priceChanges: [{ price: 20.77 }],
};

const product: ProductDetail = {
  id: 'o1',
  productCode: 'C100',
  fullProductName: 'Levora',
  description: null,
  netContent: 28,
  packRoundingThreshold: 0,
  roundToZero: true,
  dispensable: { dispensingUnit: 'each' },
  programs: [familyPlanning],
  identifiers: { tradeItem: 't1' },
};

const valid: ProgramLinkFormValues = {
  ...EMPTY_PROGRAM_LINK_FORM,
  programId: 'em',
  orderableDisplayCategoryId: 'c2',
};

const messages = (values: ProgramLinkFormValues) =>
  programLinkFormSchema()
    .safeParse(values)
    .error?.issues.map((issue) => [issue.path[0], issue.message]);

describe('programLinkFormSchema', () => {
  it('starts a new link empty, outside full supply', () => {
    expect(EMPTY_PROGRAM_LINK_FORM).toEqual({
      programId: null,
      fullSupply: false,
      dosesPerPatient: '',
      orderableDisplayCategoryId: null,
      displayOrder: '',
      pricePerPack: '',
    });
  });

  it('needs only a program and a category', () => {
    expect(messages(valid)).toBeUndefined();
    expect(messages(EMPTY_PROGRAM_LINK_FORM)).toEqual([
      ['programId', 'products.programs.form.program-required'],
      ['orderableDisplayCategoryId', 'products.programs.form.category-required'],
    ]);
  });

  it('takes whole numbers for doses and display order, without rewriting them', () => {
    expect(messages({ ...valid, dosesPerPatient: '1.5', displayOrder: '-5' })).toEqual([
      ['dosesPerPatient', 'products.programs.form.whole-number'],
      ['displayOrder', 'products.programs.form.whole-number'],
    ]);
    expect(messages({ ...valid, dosesPerPatient: '2147483648' })).toEqual([
      ['dosesPerPatient', 'products.programs.form.too-large'],
    ]);
  });

  it('takes a price that is not negative, in cents at most', () => {
    expect(messages({ ...valid, pricePerPack: '20.77' })).toBeUndefined();
    expect(messages({ ...valid, pricePerPack: '-1' })).toEqual([
      ['pricePerPack', 'products.programs.form.price-invalid'],
    ]);
    expect(messages({ ...valid, pricePerPack: '20.777' })).toEqual([
      ['pricePerPack', 'products.programs.form.price-too-precise'],
    ]);
  });
});

describe('toProgramLinkFormValues', () => {
  it('fills the form with the link, numbers as text', () => {
    expect(toProgramLinkFormValues(familyPlanning)).toEqual({
      programId: 'fp',
      fullSupply: false,
      dosesPerPatient: '1',
      orderableDisplayCategoryId: 'c1',
      displayOrder: '6',
      pricePerPack: '20.77',
    });
  });

  it('shows what the link lacks as empty fields', () => {
    expect(
      toProgramLinkFormValues({
        programId: 'fp',
        orderableDisplayCategoryId: null,
        dosesPerPatient: null,
        pricePerPack: null,
      }),
    ).toEqual({ ...EMPTY_PROGRAM_LINK_FORM, programId: 'fp' });
  });
});

describe('withProgramLink', () => {
  it('adds a new link at the end, active, keeping the rest of the product', () => {
    const body = withProgramLink(product, {
      ...valid,
      fullSupply: true,
      dosesPerPatient: '2',
      pricePerPack: '٣٫٥',
    });

    expect(body).toEqual({
      ...product,
      programs: [
        familyPlanning,
        {
          programId: 'em',
          active: true,
          fullSupply: true,
          dosesPerPatient: 2,
          orderableDisplayCategoryId: 'c2',
          displayOrder: null,
          pricePerPack: 3.5,
        },
      ],
    });
  });

  it('changes an existing link in place, keeping what the form does not show', () => {
    const body = withProgramLink(product, {
      ...toProgramLinkFormValues(familyPlanning),
      fullSupply: true,
      pricePerPack: '',
    });

    expect(body.programs).toEqual([{ ...familyPlanning, fullSupply: true, pricePerPack: null }]);
  });

  it('sends a link saved unchanged back as it was', () => {
    expect(withProgramLink(product, toProgramLinkFormValues(familyPlanning))).toEqual(product);
  });
});

describe('withoutProgramLink', () => {
  it('takes the program out and keeps the rest of the product', () => {
    expect(withoutProgramLink(product, 'fp')).toEqual({ ...product, programs: [] });
    expect(withoutProgramLink(product, 'other')).toEqual(product);
  });
});

describe('unlinkedPrograms', () => {
  it('offers the programs the product is not in yet', () => {
    const program = (id: string, name: string) => ({ id, code: id, name, active: true }) as Program;
    expect(
      unlinkedPrograms(
        [program('fp', 'Family Planning'), program('em', 'Essential Meds')],
        product,
      ),
    ).toEqual([program('em', 'Essential Meds')]);
  });
});
